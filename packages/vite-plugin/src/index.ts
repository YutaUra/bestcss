import fs from "node:fs";
import path from "node:path";
import {
  applyRename,
  collectImportSources,
  createRenameMap,
  dedupeCss,
  generateClassName,
  transform,
} from "@best-css/core";
import type { Plugin } from "vite";

const TRANSFORM_TARGET_RE = /\.[jt]sx?$/;

/**
 * 抽出した CSS を「元ファイル名 + この接尾辞」の仮想モジュールとして登録する。
 * .css で終わる id にしておくことで、Vite 自身の CSS パイプライン
 * （postcss / minify / コード分割）にそのまま処理を委ねられる
 */
const VIRTUAL_CSS_SUFFIX = ".best-css.css";

/**
 * ルート単位のスタイル収集エントリ（仮想モジュール）の接頭辞。
 * ルートファイルの import グラフ上の css`` を side-effect import として
 * 集めた「スタイルだけのエントリ」を表す
 */
const VIRTUAL_ROUTE_PREFIX = "\0best-css-route:";

/** 仮想 CSS モジュールの id からハッシュクエリを外し、Map のキーに揃える */
const stripQuery = (id: string): string => id.split("?")[0] ?? id;

/** ディレクトリ配下の .ts / .tsx / .js / .jsx を再帰的に列挙する */
function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (/\.[jt]sx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export interface BestCssOptions {
  /**
   * ビルド時にクラス名を使用頻度順の短い名前（a, b, ...）へ振り直す。
   * 無効化は、SSR した HTML を長期キャッシュする等でクラス名の
   * ビルド間安定性を優先したい場合を想定している
   *
   * @default true
   */
  minifyClassNames?: boolean;
  /**
   * リネーム表（短縮前 → 短縮後のクラス名）を共有するファイルパス。
   *
   * SSR 構成では HTML（サーバービルド）と CSS（クライアントビルド）が
   * 独立したビルドから出るため、ビルド内の頻度で決まる短縮名は一致しない。
   * クライアントビルドが確定した表をここへ書き出し、サーバービルドが
   * 同じ表を読んで書き換えることで短縮名を一致させる
   * （クライアント → サーバーの順でビルドすること）
   */
  renameMapPath?: string;
  /**
   * ルート単位の CSS 分割。dir（ルートファイルのディレクトリ）を指定すると、
   * 各ルートの import グラフ上の css`` を集めたスタイルエントリを
   * クライアントビルドに注入し、Vite のチャンク分割に「ルート専用 CSS は
   * そのルートだけ、共有 CSS は共有ファイル」の判断を委ねる。
   * ルート → CSS ファイル一覧の対応表を `.best-css/route-css.json` として
   * 出力するので、SSR の renderer がルートに応じた <link> を注入できる
   */
  routeStyles?: {
    /** ルートファイルのディレクトリ（root からの相対パス） */
    dir: string;
  };
}

export function bestCss(options: BestCssOptions = {}): Plugin {
  const minifyClassNames = options.minifyClassNames ?? true;
  const extractedCss = new Map<string, { css: string; map: string }>();
  const generatedClassNames = new Set<string>();
  let root = process.cwd();
  let isProduction = false;
  let sharedRenameMap: Map<string, string> | null = null;

  const resolveRenameMapPath = (): string | null =>
    options.renameMapPath === undefined
      ? null
      : path.resolve(root, options.renameMapPath);

  /** チャンクとその static import 先が参照する CSS アセット名を集める */
  const collectChunkCss = (
    fileName: string,
    bundle: Record<string, unknown>,
    seen: Set<string>,
  ): string[] => {
    if (seen.has(fileName)) {
      return [];
    }
    seen.add(fileName);
    const output = bundle[fileName] as
      | {
          type: string;
          imports?: string[];
          viteMetadata?: { importedCss?: Set<string> };
        }
      | undefined;
    if (output === undefined || output.type !== "chunk") {
      return [];
    }
    const css = [...(output.viteMetadata?.importedCss ?? [])];
    for (const imported of output.imports ?? []) {
      css.push(...collectChunkCss(imported, bundle, seen));
    }
    return css;
  };

  /**
   * ルート → CSS ファイル一覧の対応表を出力し、スタイル収集用の
   * 仮想エントリ（空の JS チャンク）を成果物から取り除く
   */
  const emitRouteCssManifest = (
    ctx: {
      emitFile: (file: {
        type: "asset";
        fileName: string;
        source: string;
      }) => string;
    },
    bundle: Record<string, unknown>,
  ): void => {
    if (options.routeStyles === undefined) {
      return;
    }
    const routesDir = path.resolve(root, options.routeStyles.dir);
    const manifest: Record<string, string[]> = {};
    let found = false;
    for (const [fileName, output] of Object.entries(bundle)) {
      const chunk = output as { type: string; facadeModuleId?: string | null };
      if (
        chunk.type !== "chunk" ||
        !chunk.facadeModuleId?.startsWith(VIRTUAL_ROUTE_PREFIX)
      ) {
        continue;
      }
      found = true;
      const routeFile = chunk.facadeModuleId.slice(VIRTUAL_ROUTE_PREFIX.length);
      const routeKey = path
        .relative(routesDir, routeFile)
        .replace(/\.[jt]sx?$/, "");
      manifest[routeKey] = [
        ...new Set(collectChunkCss(fileName, bundle, new Set())),
      ];
      delete bundle[fileName];
    }
    if (found) {
      ctx.emitFile({
        type: "asset",
        fileName: ".best-css/route-css.json",
        source: JSON.stringify(manifest, null, 2),
      });
    }
  };

  const loadSharedRenameMap = (): Map<string, string> => {
    if (sharedRenameMap !== null) {
      return sharedRenameMap;
    }
    const mapPath = resolveRenameMapPath();
    if (mapPath === null || !fs.existsSync(mapPath)) {
      throw new Error(
        `best-css: リネーム表 ${mapPath} が見つかりません。` +
          `renameMapPath はクライアントビルドが書き出すため、` +
          `クライアントビルドを先に実行してください。`,
      );
    }
    sharedRenameMap = new Map(
      Object.entries(
        JSON.parse(fs.readFileSync(mapPath, "utf8")) as Record<string, string>,
      ),
    );
    return sharedRenameMap;
  };

  return {
    name: "best-css",

    configResolved(config) {
      root = config.root;
      // command ではなく isProduction で判定する理由: @hono/vite-ssg は
      // ビルド中に内部のモジュールランナー（command=serve の設定）で
      // configResolved を再度呼ぶため、command はビルド中でも serve に
      // 上書きされ得る。isProduction はその場合も true を保つ
      isProduction = config.isProduction;
    },

    buildStart() {
      if (options.routeStyles === undefined) {
        return;
      }
      // dev サーバーや SSR ビルドでは注入しない。スタイルエントリは
      // クライアントの本番ビルドが CSS を出力するための仕組みのため
      const environment = (
        this as {
          environment?: { mode?: string; config?: { consumer?: string } };
        }
      ).environment;
      if (
        environment?.mode !== "build" ||
        environment.config?.consumer === "server"
      ) {
        return;
      }
      const routesDir = path.resolve(root, options.routeStyles.dir);
      for (const routeFile of walkDir(routesDir)) {
        const routeKey = path
          .relative(routesDir, routeFile)
          .replace(/\.[jt]sx?$/, "");
        this.emitFile({
          type: "chunk",
          id: VIRTUAL_ROUTE_PREFIX + routeFile,
          name: `best-css-route/${routeKey}`,
        });
      }
    },
    // enforce: "pre" にする理由: JSX 変換（@vitejs/plugin-react や esbuild）より
    // 前にユーザーが書いた元ソースを受け取り、css`` の位置情報を保つため
    enforce: "pre",

    resolveId(source, importer) {
      if (source.startsWith(VIRTUAL_ROUTE_PREFIX)) {
        return source;
      }
      // 仮想 CSS モジュールはファイルシステムに存在しないため、
      // 他のリゾルバに渡さずここで解決を確定させる
      const base = stripQuery(source);
      if (!base.endsWith(VIRTUAL_CSS_SUFFIX)) {
        return null;
      }
      if (extractedCss.has(base)) {
        return source;
      }
      // まだ変換していないソースの仮想 CSS も、元ファイルが実在するなら
      // 解決する（load 側でオンデマンドに変換する）。相対指定は
      // importer 基準で絶対パスに直す
      const absolute =
        base.startsWith(".") && importer !== undefined
          ? path.resolve(path.dirname(stripQuery(importer)), base)
          : base;
      const sourceFile = absolute.slice(0, -VIRTUAL_CSS_SUFFIX.length);
      if (fs.existsSync(sourceFile)) {
        return absolute;
      }
      return null;
    },

    async load(id) {
      if (id.startsWith(VIRTUAL_ROUTE_PREFIX)) {
        // ルートの import グラフを辿り、css`` を含むファイルの仮想 CSS を
        // side-effect import するだけのモジュールを生成する。
        // ルート専用/共有の分割判断は Vite のチャンク分割に委ねる
        const routeFile = id.slice(VIRTUAL_ROUTE_PREFIX.length);
        const visited = new Set<string>();
        const styledFiles: string[] = [];
        const walk = async (file: string): Promise<void> => {
          if (visited.has(file)) {
            return;
          }
          visited.add(file);
          let code: string;
          try {
            code = fs.readFileSync(file, "utf8");
          } catch {
            return;
          }
          if (code.includes("@best-css/core")) {
            styledFiles.push(file);
          }
          for (const spec of collectImportSources(code, file)) {
            const resolved = await this.resolve(spec, file);
            if (resolved === null) {
              continue;
            }
            const resolvedId = stripQuery(resolved.id);
            if (
              resolvedId.includes("/node_modules/") ||
              !/\.[jt]sx?$/.test(resolvedId) ||
              !fs.existsSync(resolvedId)
            ) {
              continue;
            }
            await walk(resolvedId);
          }
        };
        await walk(routeFile);
        return (
          styledFiles
            .map((f) => `import ${JSON.stringify(f + VIRTUAL_CSS_SUFFIX)};`)
            .join("\n") + "\nexport {};\n"
        );
      }

      const base = stripQuery(id);
      if (!base.endsWith(VIRTUAL_CSS_SUFFIX)) {
        return null;
      }
      let entry = extractedCss.get(base);
      if (entry === undefined) {
        // ソースを JS として import しない利用（routeStyles の
        // スタイルエントリ等）のため、ここでオンデマンドに変換する
        const sourceFile = base.slice(0, -VIRTUAL_CSS_SUFFIX.length);
        if (!fs.existsSync(sourceFile)) {
          return null;
        }
        const result = transform(fs.readFileSync(sourceFile, "utf8"), {
          filename: sourceFile,
        });
        if (result === null) {
          // @best-css/core を import していても css`` がないファイルは
          // 空の CSS として扱う（ENOENT でビルドを壊さない）
          return "";
        }
        entry = { css: result.css, map: result.cssMap };
        extractedCss.set(base, entry);
        for (const className of result.classNames) {
          generatedClassNames.add(className);
        }
      }
      // map を添えることで、css.devSourcemap 有効時に DevTools の Styles
      // ペインから元の tsx（css`` の位置）へ辿れるようになる
      return { code: entry.css, map: entry.map };
    },

    transform(code, id) {
      if (!TRANSFORM_TARGET_RE.test(id) || id.includes("/node_modules/")) {
        return null;
      }
      const result = transform(code, { filename: id });
      if (result === null) {
        // css`` が全て削除された場合、新しいコードに import が残らないため
        // Vite の HMR prune が古い style 要素を除去する。ここでの後始末は不要
        return null;
      }

      const cssId = id + VIRTUAL_CSS_SUFFIX;
      extractedCss.set(cssId, { css: result.css, map: result.cssMap });
      for (const className of result.classNames) {
        generatedClassNames.add(className);
      }

      // サーバー（SSR）向けの変換では CSS import を付与しない。
      // SSR バンドルに必要なのはクラス名だけで、CSS の配信は
      // クライアントビルドの責務のため（サーバーバンドルも汚さない）
      const consumer = (
        this as { environment?: { config?: { consumer?: string } } }
      ).environment?.config?.consumer;
      if (consumer === "server") {
        let serverCode = result.code;
        // リネーム表の適用を generateBundle ではなく変換時に行う理由:
        // @hono/vite-ssg のように、バンドルを作らずモジュールランナーで
        // サーバーコードを実行して HTML を書き出すツールでは
        // generateBundle が HTML 生成経路を通らないため。
        // dev（vite dev）は表を使わない（クライアント側も bc 名のため）
        if (isProduction && resolveRenameMapPath() !== null) {
          serverCode = applyRename(serverCode, loadSharedRenameMap());
        }
        return { code: serverCode, map: result.map };
      }

      // import URL に CSS の内容ハッシュを付ける理由: ブラウザは ESM モジュールを
      // URL 単位でキャッシュするため、サーバー側の内容更新だけでは再取得されない。
      // モジュールグラフの invalidate（?t= 方式）はグラフの内部状態に依存して
      // 空振りし得たため、内容が変われば URL が必ず変わるこの方式にした
      const versionedCssId = `${cssId}?hash=${generateClassName(result.css)}`;
      // import 行は map 生成後の末尾追記だが、行の追加は既存行の
      // マッピングをずらさないためソースマップはそのまま有効
      return {
        code: `${result.code}\nimport ${JSON.stringify(versionedCssId)};\n`,
        map: result.map,
      };
    },

    generateBundle: {
      // プラグイン全体は enforce: "pre" のため、order: "post" を付けないと
      // Vite 内部（css-post）が CSS アセットを bundle に追加する前に走ってしまう
      order: "post",
      handler(_options, bundle) {
        // 同一内容の css`` が複数ファイルにあると、クラス名は内容ハッシュで
        // 同一に収束する一方、CSS 本文は各仮想モジュールから重複して出力される。
        // Vite の cssMinify（Lightning CSS）も重複をマージするが、minify を
        // 無効にした構成でも「サイズ最適化」の保証が消えないよう自前でも行う
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === "asset" && fileName.endsWith(".css")) {
            output.source = dedupeCss(String(output.source));
          }
        }

        emitRouteCssManifest(this, bundle);

        if (!minifyClassNames) {
          return;
        }

        const renameMapPath = resolveRenameMapPath();
        const consumer = (
          this as { environment?: { config?: { consumer?: string } } }
        ).environment?.config?.consumer;

        if (consumer === "server") {
          // サーバービルドは自分の頻度で短縮しない。CSS を持つのは
          // クライアントビルドであり、独立に計算した短縮名は一致しないため。
          // 表があるときだけ、それに従って書き換える（transform 時に
          // 適用済みだが、バンドル型 SSR での取りこぼしをここで拾う）
          if (renameMapPath === null) {
            return;
          }
          const sharedMap = loadSharedRenameMap();
          for (const output of Object.values(bundle)) {
            if (output.type === "chunk") {
              output.code = applyRename(output.code, sharedMap);
            }
          }
          return;
        }

        if (generatedClassNames.size === 0) {
          return;
        }

        // 使用頻度は JS チャンク内の静的な出現回数を代理指標にする。
        // 実行時の描画回数は分からないが、全クラスが 1〜3 文字になるため
        // 順位の精度がサイズに与える影響は小さい
        const frequencies = new Map<string, number>(
          [...generatedClassNames].map((name) => [name, 0]),
        );
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") {
            continue;
          }
          for (const matched of output.code.matchAll(/\bbc[a-z0-9]+\b/g)) {
            const count = frequencies.get(matched[0]);
            if (count !== undefined) {
              frequencies.set(matched[0], count + 1);
            }
          }
        }

        const renameMap = createRenameMap(frequencies);
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === "chunk") {
            output.code = applyRename(output.code, renameMap);
          } else if (fileName.endsWith(".css")) {
            output.source = applyRename(String(output.source), renameMap);
          }
        }

        // 確定した表を書き出し、後続のサーバービルドに共有する。
        // CSS アセットを持つ環境に限定する理由: SSG 等が走らせる空の
        // クライアント環境が、確定済みの表を上書きするのを防ぐため
        const hasCssAsset = Object.keys(bundle).some((fileName) =>
          fileName.endsWith(".css"),
        );
        if (renameMapPath !== null && hasCssAsset) {
          fs.mkdirSync(path.dirname(renameMapPath), { recursive: true });
          fs.writeFileSync(
            renameMapPath,
            JSON.stringify(Object.fromEntries(renameMap), null, 2),
          );
        }
      },
    },
  };
}
