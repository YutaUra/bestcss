import fs from "node:fs";
import path from "node:path";
import {
  applyRename,
  collectImportSources,
  createRenameMap,
  dedupeCss,
  generateClassName,
  transform,
} from "@bestcss/core";
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

/** ルート → CSS ファイル一覧の対応表（ビルド時にインラインされる） */
const VIRTUAL_ROUTE_MANIFEST = "virtual:best-css/route-css";
const RESOLVED_ROUTE_MANIFEST = "\0virtual:best-css/route-css";

/** dev で全ルートのスタイルを HMR 付きで読み込むための仮想モジュール */
const VIRTUAL_DEV_STYLES = "virtual:best-css/dev-styles";
const RESOLVED_DEV_STYLES = "\0virtual:best-css/dev-styles";

/**
 * client / server ビルド間で共有する中間生成物の置き場所（root 相対）。
 * node_modules 配下にするのは、VCS に入らず outDir 設定にも依存しないため
 */
const SHARE_DIR = "node_modules/.best-css";

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

export interface BestCssSsrOptions {
  /**
   * ルートファイルのディレクトリ（root からの相対パス。例: "app/routes"）。
   * 指定すると各ルートの import グラフから CSS を集めてルート単位に分割し、
   * ルート → CSS の対応表を出力する。renderer 側は
   * `@bestcss/vite-plugin/route-css` の routeCssHrefs で <link> を注入できる
   */
  routesDir?: string;
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
   * SSR プロジェクト（client / server の 2 パスビルド）であることを宣言する。
   * client / server どちらの設定にも同じ値を渡せばよい。
   *
   * - クラス名短縮のリネーム表をビルド間で自動共有し、SSR された HTML と
   *   配信 CSS の短縮名を一致させる（ビルドは client → server の順）
   * - routesDir を指定するとルート単位の CSS 分割も有効になる
   */
  ssr?: boolean | BestCssSsrOptions;
}

export function bestCss(options: BestCssOptions = {}): Plugin {
  const minifyClassNames = options.minifyClassNames ?? true;
  const ssr =
    options.ssr === undefined || options.ssr === false
      ? null
      : options.ssr === true
        ? {}
        : options.ssr;
  const extractedCss = new Map<string, { css: string; map: string }>();
  /** 遅延ロードした仮想 CSS の鮮度管理（ソースの mtime） */
  const sourceMtimes = new Map<string, number>();
  const generatedClassNames = new Set<string>();
  let root = process.cwd();
  let isProduction = false;
  let sharedRenameMap: Map<string, string> | null = null;

  const renameMapPath = (): string | null =>
    ssr === null ? null : path.resolve(root, SHARE_DIR, "rename-map.json");

  const routeManifestPath = (): string =>
    path.resolve(root, SHARE_DIR, "route-css.json");

  const routesDirPath = (): string | null =>
    ssr?.routesDir === undefined ? null : path.resolve(root, ssr.routesDir);

  const loadSharedRenameMap = (): Map<string, string> => {
    if (sharedRenameMap !== null) {
      return sharedRenameMap;
    }
    const mapPath = renameMapPath();
    if (mapPath === null || !fs.existsSync(mapPath)) {
      throw new Error(
        `best-css: リネーム表 ${mapPath} が見つかりません。` +
          `表はクライアントビルドが書き出すため、` +
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

  /** ルートファイルの import グラフを辿り、css`` を含むファイルを集める */
  const collectStyledFiles = async (
    ctx: {
      resolve: (
        source: string,
        importer?: string,
      ) => Promise<{ id: string } | null>;
    },
    entryFile: string,
  ): Promise<string[]> => {
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
      const importSources = collectImportSources(code, file);
      // 文字列やコメントに "@bestcss/core" を含むだけのファイル（core 自身の
      // 実装など）を拾わないよう、AST 上の import 指定子で判定する
      if (importSources.includes("@bestcss/core")) {
        styledFiles.push(file);
      }
      for (const spec of importSources) {
        const resolved = await ctx.resolve(spec, file);
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
    await walk(entryFile);
    return styledFiles;
  };

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
   * ルート → CSS ファイル一覧の対応表を書き出し、スタイル収集用の
   * 仮想エントリ（空の JS チャンク）を成果物から取り除く
   */
  const writeRouteCssManifest = (bundle: Record<string, unknown>): void => {
    const routesDir = routesDirPath();
    if (routesDir === null) {
      return;
    }
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
      const manifestPath = routeManifestPath();
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  };

  return {
    name: "best-css",
    // enforce: "pre" にする理由: JSX 変換（@vitejs/plugin-react や esbuild）より
    // 前にユーザーが書いた元ソースを受け取り、css`` の位置情報を保つため
    enforce: "pre",

    config() {
      // route-css ヘルパー（@bestcss/vite-plugin/route-css）は仮想モジュールを
      // import するため、SSR で externalize されると Node がそのまま実行して
      // 解決に失敗する。プラグイン側で noExternal を設定し、利用側の設定を不要にする
      return {
        ssr: { noExternal: ["@bestcss/vite-plugin"] },
      };
    },

    configResolved(config) {
      root = config.root;
      // command ではなく isProduction で判定する理由: @hono/vite-ssg は
      // ビルド中に内部のモジュールランナー（command=serve の設定）で
      // configResolved を再度呼ぶため、command はビルド中でも serve に
      // 上書きされ得る。isProduction はその場合も true を保つ
      isProduction = config.isProduction;
    },

    buildStart() {
      const routesDir = routesDirPath();
      if (routesDir === null) {
        return;
      }
      const environment = (
        this as {
          environment?: {
            mode?: string;
            config?: {
              consumer?: string;
              build?: { rollupOptions?: { input?: unknown } };
            };
          };
        }
      ).environment;
      // スタイルエントリは「CSS を出力するクライアントの本番ビルド」にだけ
      // 注入する。input 未定義の環境を除外するのは、SSG 等がビルド中に
      // 走らせる空のクライアント環境（成果物と manifest を汚す）を避けるため
      const input = environment?.config?.build?.rollupOptions?.input;
      const hasInput = Array.isArray(input)
        ? input.length > 0
        : typeof input === "string"
          ? true
          : input !== undefined &&
            input !== null &&
            Object.keys(input).length > 0;
      if (
        environment?.mode !== "build" ||
        environment.config?.consumer === "server" ||
        !hasInput
      ) {
        return;
      }
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

    resolveId(source, importer) {
      if (source === VIRTUAL_ROUTE_MANIFEST) {
        return RESOLVED_ROUTE_MANIFEST;
      }
      if (source === VIRTUAL_DEV_STYLES) {
        return RESOLVED_DEV_STYLES;
      }
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
      if (id === RESOLVED_ROUTE_MANIFEST) {
        // 本番はビルド時に対応表をインラインする（実行時 fs アクセス不要）。
        // dev は null（スタイルは dev-styles 経由で注入されるため）
        const manifestPath = routeManifestPath();
        if (isProduction && fs.existsSync(manifestPath)) {
          return `export default ${fs.readFileSync(manifestPath, "utf8")};`;
        }
        return "export default null;";
      }

      if (id === RESOLVED_DEV_STYLES) {
        // dev 専用: 全ルートの import グラフからスタイルを収集して読み込む。
        // 本番ビルドでは空になり、ルート単位のスタイルエントリに置き換わる
        const routesDir = routesDirPath();
        if (isProduction || routesDir === null || !fs.existsSync(routesDir)) {
          return "export {};";
        }
        const styled = new Set<string>();
        for (const routeFile of walkDir(routesDir)) {
          for (const file of await collectStyledFiles(this, routeFile)) {
            styled.add(file);
          }
        }
        return (
          [...styled]
            .map((f) => `import ${JSON.stringify(f + VIRTUAL_CSS_SUFFIX)};`)
            .join("\n") + "\nexport {};\n"
        );
      }

      if (id.startsWith(VIRTUAL_ROUTE_PREFIX)) {
        // ルートの import グラフを辿り、css`` を含むファイルの仮想 CSS を
        // side-effect import するだけのモジュールを生成する。
        // ルート専用/共有の分割判断は Vite のチャンク分割に委ねる
        const routeFile = id.slice(VIRTUAL_ROUTE_PREFIX.length);
        const styledFiles = await collectStyledFiles(this, routeFile);
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
      const sourceFile = base.slice(0, -VIRTUAL_CSS_SUFFIX.length);
      let entry = extractedCss.get(base);
      // ソースを JS として import しない利用（routeStyles / dev-styles）でも
      // 内容が新しくなるよう、mtime で鮮度を確認してオンデマンドに変換する
      if (fs.existsSync(sourceFile)) {
        const mtime = fs.statSync(sourceFile).mtimeMs;
        if (entry === undefined || sourceMtimes.get(base) !== mtime) {
          const result = transform(fs.readFileSync(sourceFile, "utf8"), {
            filename: sourceFile,
          });
          sourceMtimes.set(base, mtime);
          if (result === null) {
            // @bestcss/core を import していても css`` がないファイルは
            // 空の CSS として扱う（ENOENT でビルドを壊さない）
            return "";
          }
          entry = { css: result.css, map: result.cssMap };
          extractedCss.set(base, entry);
          for (const className of result.classNames) {
            generatedClassNames.add(className);
          }
        }
      }
      if (entry === undefined) {
        return null;
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
        if (isProduction && ssr !== null && minifyClassNames) {
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

    hotUpdate(ctx: { file: string; modules: unknown[] }) {
      // dev-styles 経由でのみ読み込まれている仮想 CSS は、元ファイルの
      // 変更を watcher が関連付けられないため、ここで明示的に更新対象に加える
      const cssId = ctx.file + VIRTUAL_CSS_SUFFIX;
      const graph = (
        this as {
          environment?: {
            moduleGraph?: { getModuleById?: (id: string) => unknown };
          };
        }
      ).environment?.moduleGraph;
      const mod = graph?.getModuleById?.(cssId);
      if (mod === undefined || mod === null) {
        return;
      }
      return [...ctx.modules, mod] as never;
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

        writeRouteCssManifest(bundle);

        if (!minifyClassNames) {
          return;
        }

        const consumer = (
          this as { environment?: { config?: { consumer?: string } } }
        ).environment?.config?.consumer;

        if (consumer === "server") {
          // サーバービルドは自分の頻度で短縮しない。CSS を持つのは
          // クライアントビルドであり、独立に計算した短縮名は一致しないため。
          // ssr 設定時のみ、共有された表に従って書き換える（transform 時に
          // 適用済みだが、バンドル型 SSR での取りこぼしをここで拾う）
          if (ssr === null) {
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
        const mapPath = renameMapPath();
        const hasCssAsset = Object.keys(bundle).some((fileName) =>
          fileName.endsWith(".css"),
        );
        if (mapPath !== null && hasCssAsset) {
          fs.mkdirSync(path.dirname(mapPath), { recursive: true });
          fs.writeFileSync(
            mapPath,
            JSON.stringify(Object.fromEntries(renameMap), null, 2),
          );
        }
      },
    },
  };
}
