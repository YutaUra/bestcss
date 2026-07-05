import fs from "node:fs";
import path from "node:path";
import {
  applyRename,
  collectImportSources,
  createRenameMap,
  dedupeCss,
  generateClassName,
  minifyCss,
  transform,
  resolveTargets,
  type Targets,
} from "@bestcss/core";
import type { Plugin } from "vite";

const TRANSFORM_TARGET_RE = /\.[jt]sx?$/;

/**
 * 抽出した CSS を「元ファイル名 + この接尾辞」の仮想モジュールとして登録する。
 * .css で終わる id にしておくことで、Vite 自身の CSS パイプライン
 * （postcss / minify / コード分割）にそのまま処理を委ねられる
 */
const VIRTUAL_CSS_SUFFIX = ".bestcss.css";

/** ルート → CSS ファイル一覧の対応表（ビルド時にインラインされる） */
const VIRTUAL_ROUTE_MANIFEST = "virtual:bestcss/route-css";
const RESOLVED_ROUTE_MANIFEST = "\0virtual:bestcss/route-css";

/** dev で全ルートのスタイルを HMR 付きで読み込むための仮想モジュール */
const VIRTUAL_DEV_STYLES = "virtual:bestcss/dev-styles";
const RESOLVED_DEV_STYLES = "\0virtual:bestcss/dev-styles";

/**
 * client / server ビルド間で共有する中間生成物の置き場所（root 相対）。
 * node_modules 配下にするのは、VCS に入らず outDir 設定にも依存しないため
 */
const SHARE_DIR = "node_modules/.bestcss";

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
  /**
   * カスケードレイヤーの順序宣言（下位 → 上位）。
   * css`` 内で `@layer name { ... }` を使う場合は必須で、使用する名前は
   * すべてこの一覧に含まれていなければならない（初出順依存の
   * 非決定的なレイヤー順を構造的に排除するため）
   *
   * @example bestCss({ layers: ["base", "components", "utilities"] })
   */
  layers?: string[];
  /**
   * 対応ブラウザの browserslist クエリ。指定するとネストのフラット化や
   * ベンダープレフィックス付与などのダウンレベルが行われる。
   *
   * - 未指定: プロジェクトの browserslist 設定（package.json /
   *   .browserslistrc）を自動検出する。設定もなければダウンレベルなし
   *   （書いた生 CSS がそのまま出る、モダンブラウザ前提）
   * - false: 設定があっても無視してダウンレベルしない
   *
   * @example bestCss({ targets: "defaults" })
   */
  targets?: string | string[] | false;
}

export function bestCss(options: BestCssOptions = {}): Plugin {
  const minifyClassNames = options.minifyClassNames ?? true;
  const layers = options.layers;
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
  /** ルートキー → そのルートの import グラフ上の styled ファイル一覧 */
  const routeStyledFiles = new Map<string, string[]>();
  let root = process.cwd();
  let isProduction = false;
  let targets: Targets | undefined;
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
        `bestcss: リネーム表 ${mapPath} が見つかりません。` +
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

  /**
   * 仮想 CSS の内容を（未変換ならオンデマンドに変換して）取得する。
   * mtime で鮮度を確認するため、dev の編集にも追従する
   */
  const ensureCssEntry = (
    base: string,
  ): { css: string; map: string } | null => {
    const sourceFile = base.slice(0, -VIRTUAL_CSS_SUFFIX.length);
    const entry = extractedCss.get(base);
    if (!fs.existsSync(sourceFile)) {
      return entry ?? null;
    }
    const mtime = fs.statSync(sourceFile).mtimeMs;
    if (entry !== undefined && sourceMtimes.get(base) === mtime) {
      return entry;
    }
    const result = transform(fs.readFileSync(sourceFile, "utf8"), {
      filename: sourceFile,
      layers,
      targets,
    });
    sourceMtimes.set(base, mtime);
    if (result === null) {
      // @bestcss/core を import していても css`` がないファイル
      return null;
    }
    const fresh = { css: result.css, map: result.cssMap };
    extractedCss.set(base, fresh);
    for (const className of result.classNames) {
      generatedClassNames.add(className);
    }
    return fresh;
  };

  /**
   * ルート単位の CSS アセットを「共有シグネチャ」でグループ化して自前 emit し、
   * ルート → CSS ファイル一覧の対応表を書き出す。
   *
   * チャンクグラフ（viteMetadata / imports の走査）から導出しない理由:
   * 空 JS のスタイルエントリは Vite の pure-CSS チャンク処理で統合・除去され、
   * 「どのルートがこの CSS を必要とするか」の情報がバージョン依存の挙動で
   * 消えるため（issue #2: Vite 6 で共有 CSS が 1 ルートに誤帰属）。
   * ルート → styled モジュールの対応はプラグイン自身が知っているので、
   * それだけを情報源にする
   */
  const emitRouteCssAssets = (
    ctx: {
      emitFile: (file: {
        type: "asset";
        fileName: string;
        source: string;
      }) => string;
    },
    bundle: Record<string, unknown>,
    renameMap: Map<string, string> | null,
  ): void => {
    if (routesDirPath() === null || routeStyledFiles.size === 0) {
      return;
    }
    // 同じルート集合から参照されるモジュールを 1 アセットにまとめる。
    // 全ルート共有なら 1 ファイル（キャッシュ効率）、ルート専用なら
    // そのルートだけのファイルになり、fan-out と共有バケットを兼ねる
    const routesByFile = new Map<string, Set<string>>();
    for (const [routeKey, files] of routeStyledFiles) {
      for (const file of files) {
        const routes = routesByFile.get(file) ?? new Set<string>();
        routes.add(routeKey);
        routesByFile.set(file, routes);
      }
    }
    const groups = new Map<string, { routes: string[]; files: string[] }>();
    for (const [file, routes] of routesByFile) {
      const sortedRoutes = [...routes].sort();
      const signature = sortedRoutes.join("\n");
      const group = groups.get(signature) ?? {
        routes: sortedRoutes,
        files: [],
      };
      group.files.push(file);
      groups.set(signature, group);
    }

    const manifest: Record<string, string[]> = {};
    for (const routeKey of routeStyledFiles.keys()) {
      manifest[routeKey] = [];
    }
    for (const group of groups.values()) {
      const cssText = dedupeCss(
        group.files
          .sort()
          .map((file) => ensureCssEntry(file + VIRTUAL_CSS_SUFFIX)?.css ?? "")
          .filter((css) => css !== "")
          .join("\n"),
      );
      if (cssText.trim() === "") {
        continue;
      }
      // emitFile したアセットは同一 handler 内の bundle 走査に現れないため、
      // クラス名短縮は emit 前にここで適用する（表は呼び出し側で確定済み）
      // minify にも targets を渡す理由: Lightning CSS はターゲット不明だと
      // 最新構文への書き換えを行い得るため、変換時のダウンレベルと矛盾させない
      let minified = minifyCss(cssText, targets);
      if (renameMap !== null) {
        minified = applyRename(minified, renameMap);
      }
      // minifyCss（Lightning CSS）による順序宣言の切り詰めを修復する
      if (layers !== undefined && minified.includes("@layer")) {
        minified = dedupeCss(`@layer ${layers.join(", ")};\n${minified}`);
      }
      const fileName = `assets/bestcss.${generateClassName(minified)}.css`;
      if (!(fileName in bundle)) {
        ctx.emitFile({ type: "asset", fileName, source: minified });
      }
      for (const routeKey of group.routes) {
        manifest[routeKey]?.push(fileName);
      }
    }

    const manifestPath = routeManifestPath();
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  };

  return {
    name: "bestcss",
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
      // browserslist の設定探索はプロジェクトルート基準で 1 回だけ行う
      targets =
        options.targets === false
          ? undefined
          : resolveTargets(options.targets, root);
      // command ではなく isProduction で判定する理由: @hono/vite-ssg は
      // ビルド中に内部のモジュールランナー（command=serve の設定）で
      // configResolved を再度呼ぶため、command はビルド中でも serve に
      // 上書きされ得る。isProduction はその場合も true を保つ
      isProduction = config.isProduction;
    },

    async buildStart() {
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
      // ルート → styled ファイルの収集は「CSS を出力するクライアントの
      // 本番ビルド」でだけ行う。input 未定義の環境を除外するのは、SSG 等が
      // ビルド中に走らせる空のクライアント環境（manifest を汚す）を避けるため
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
      routeStyledFiles.clear();
      for (const routeFile of walkDir(routesDir)) {
        const routeKey = path
          .relative(routesDir, routeFile)
          .replace(/\.[jt]sx?$/, "");
        routeStyledFiles.set(
          routeKey,
          await collectStyledFiles(this, routeFile),
        );
      }
    },

    resolveId(source, importer) {
      // moduleSideEffects: true を明示する理由: 注入する CSS import は
      // side-effect import であり、"sideEffects": false を宣言した
      // パッケージ（コンポーネントライブラリ等）の中ではツリーシェイクで
      // 静かに落とされてしまう。利用者の設定に依存せず保持させる
      const asSideEffect = (id: string) => ({
        id,
        moduleSideEffects: true as const,
      });
      if (source === VIRTUAL_ROUTE_MANIFEST) {
        return RESOLVED_ROUTE_MANIFEST;
      }
      if (source === VIRTUAL_DEV_STYLES) {
        return asSideEffect(RESOLVED_DEV_STYLES);
      }
      // 仮想 CSS モジュールはファイルシステムに存在しないため、
      // 他のリゾルバに渡さずここで解決を確定させる
      const base = stripQuery(source);
      if (!base.endsWith(VIRTUAL_CSS_SUFFIX)) {
        return null;
      }
      if (extractedCss.has(base)) {
        return asSideEffect(source);
      }
      // まだ変換していないソースの仮想 CSS も、元ファイルが実在するなら
      // 解決する（load 側でオンデマンドに変換する）。相対指定は
      // importer 基準、"/" 始まりは fs 絶対パスと root 相対 URL の両方を試す
      // （後者は dev の <link href="/app/....bestcss.css?direct"> 由来）
      const candidates =
        base.startsWith(".") && importer !== undefined
          ? [path.resolve(path.dirname(stripQuery(importer)), base)]
          : base.startsWith("/")
            ? [base, path.join(root, base)]
            : [base];
      // ?direct 等のクエリは解決後の id にも残す。落とすと Vite の CSS
      // プラグインが「生 CSS を返すリクエスト」と識別できず、<link> に
      // JS ラッパーが配信されてしまう
      const query = source.slice(base.length);
      for (const candidate of candidates) {
        const sourceFile = candidate.slice(0, -VIRTUAL_CSS_SUFFIX.length);
        if (fs.existsSync(sourceFile)) {
          return asSideEffect(candidate + query);
        }
      }
      return null;
    },

    async load(id) {
      if (id === RESOLVED_ROUTE_MANIFEST) {
        // 本番はビルド時に対応表をインラインする（実行時 fs アクセス不要）
        if (isProduction) {
          const manifestPath = routeManifestPath();
          if (fs.existsSync(manifestPath)) {
            return `export default ${fs.readFileSync(manifestPath, "utf8")};`;
          }
          return "export default null;";
        }
        // dev はルートを走査し、Vite が生 CSS として配信する dev 用 URL
        // （?direct）を返す。これにより renderer は dev / prod 同一の
        // routeCssHrefs 経路で <link> を張れる。island を持たない純 SSR で
        // クライアント JS が読み込まれなくてもスタイルが当たる（issue #3）
        const routesDir = routesDirPath();
        if (routesDir === null || !fs.existsSync(routesDir)) {
          return "export default null;";
        }
        const manifest: Record<string, string[]> = {};
        for (const routeFile of walkDir(routesDir)) {
          const routeKey = path
            .relative(routesDir, routeFile)
            .replace(/\.[jt]sx?$/, "");
          const files = await collectStyledFiles(this, routeFile);
          manifest[routeKey] = files.map((file) => {
            const cssId = file + VIRTUAL_CSS_SUFFIX;
            const relative = path.relative(root, cssId);
            // root 外のファイルは Vite の /@fs/ 形式で配信される
            const urlPath = relative.startsWith("..")
              ? `@fs${cssId}`
              : relative;
            return `${urlPath}?direct`;
          });
        }
        return `export default ${JSON.stringify(manifest)};`;
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

      const base = stripQuery(id);
      if (!base.endsWith(VIRTUAL_CSS_SUFFIX)) {
        return null;
      }
      // ソースを JS として import しない利用（dev-styles 等）でも内容が
      // 新しくなるよう、mtime で鮮度を確認してオンデマンドに変換する
      const entry = ensureCssEntry(base);
      if (entry === null) {
        // @bestcss/core を import していても css`` がないファイルは
        // 空の CSS として扱う（ENOENT でビルドを壊さない）
        return fs.existsSync(base.slice(0, -VIRTUAL_CSS_SUFFIX.length))
          ? ""
          : null;
      }
      // map を添えることで、css.devSourcemap 有効時に DevTools の Styles
      // ペインから元の tsx（css`` の位置）へ辿れるようになる。
      // moduleSideEffects は resolveId に加えてここでも明示する
      // （sideEffects: false 宣言下でのツリーシェイク耐性）
      return { code: entry.css, map: entry.map, moduleSideEffects: true };
    },

    transform(code, id) {
      if (!TRANSFORM_TARGET_RE.test(id) || id.includes("/node_modules/")) {
        return null;
      }
      const result = transform(code, { filename: id, layers, targets });
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
      const environment = (
        this as {
          environment?: {
            name?: string;
            hot?: { send?: (payload: unknown) => void };
            moduleGraph?: {
              getModuleById?: (id: string) => unknown;
              getModulesByFile?: (file: string) => Set<unknown> | undefined;
              invalidateModule?: (mod: never) => void;
            };
          };
        }
      ).environment;
      const graph = environment?.moduleGraph;
      if (graph === undefined) {
        return;
      }
      // ルート構成やスタイル集合の変化に追従するため manifest は毎回無効化する
      // （dev manifest は次のリクエストで再走査される。安価）
      const manifestMod = graph.getModuleById?.(RESOLVED_ROUTE_MANIFEST);
      if (manifestMod !== undefined && manifestMod !== null) {
        graph.invalidateModule?.(manifestMod as never);
      }
      // 仮想 CSS は watcher が元ファイルと関連付けられないため、
      // ?direct / ?hash などの変種も含めて明示的に無効化する
      const cssId = ctx.file + VIRTUAL_CSS_SUFFIX;
      const mods = graph.getModulesByFile?.(cssId);
      if (mods === undefined || mods.size === 0) {
        return;
      }
      const extra: unknown[] = [];
      let linkOnly = false;
      for (const mod of mods) {
        // ?hash= 付きの変種（import 用）は無効化せず HMR 更新対象にも
        // 含めない。内容アドレス方式なので同一 URL の内容は不変で、
        // 内容が変われば import URL 自体が変わる。更新対象に含めると
        // Vite が lastHMRTimestamp を付け、同一内容の保存でも import に
        // ?t= が付与されて「内容不変なら URL 不変」の保証が壊れる
        if (((mod as { id?: string }).id ?? "").includes("?hash=")) {
          continue;
        }
        graph.invalidateModule?.(mod as never);
        extra.push(mod);
        const importers = (mod as { importers?: Set<unknown> }).importers;
        if ((importers?.size ?? 0) === 0) {
          linkOnly = true;
        }
      }
      // <link ?direct> 専用供給（JS の importer がいない）は HMR 境界を
      // 持たないため、full-reload で編集を反映する（issue #3）
      if (linkOnly && environment?.name === "client") {
        environment.hot?.send?.({ type: "full-reload" });
      }
      return [...ctx.modules, ...extra] as never;
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
            let source = String(output.source);
            // Vite の cssMinify（Lightning CSS）はレイヤー順宣言を
            // ブロック出現順ベースに切り詰めることがあり、モジュール結合順に
            // 依存した順序へ壊れ得る。権威ある完全な宣言を先頭に付与して
            // 順序を確定させる（後続の切り詰め断片は CSS 仕様上無害になる）
            if (layers !== undefined && source.includes("@layer")) {
              source = `@layer ${layers.join(", ")};\n${source}`;
            }
            output.source = dedupeCss(source);
          }
        }

        // ルート単位 CSS の全クラス名を、リネーム表の計算より前に登録する。
        // ルート専用モジュールはクライアントの JS グラフに入らないため、
        // ここで変換しておかないと表から漏れて短縮の対象外になってしまう
        for (const files of routeStyledFiles.values()) {
          for (const file of files) {
            ensureCssEntry(file + VIRTUAL_CSS_SUFFIX);
          }
        }

        const consumer = (
          this as { environment?: { config?: { consumer?: string } } }
        ).environment?.config?.consumer;

        let renameMap: Map<string, string> | null = null;

        if (minifyClassNames && consumer === "server") {
          // サーバービルドは自分の頻度で短縮しない。CSS を持つのは
          // クライアントビルドであり、独立に計算した短縮名は一致しないため。
          // ssr 設定時のみ、共有された表に従って書き換える（transform 時に
          // 適用済みだが、バンドル型 SSR での取りこぼしをここで拾う）
          if (ssr !== null) {
            const sharedMap = loadSharedRenameMap();
            for (const output of Object.values(bundle)) {
              if (output.type === "chunk") {
                output.code = applyRename(output.code, sharedMap);
              }
            }
          }
        } else if (minifyClassNames) {
          // 短縮対象は自前生成のクラス名に加え、CSS アセットのセレクタ
          // （.bc...）からも収穫する。プリコンパイル配布されたライブラリは
          // bc 名のまま出荷される（作者側は minifyClassNames: false）ため、
          // アセットから拾わないと利用側ビルドで短縮されずに残る。
          // webpack プラグインと同じ自己完結方式
          const knownNames = new Set(generatedClassNames);
          for (const [fileName, output] of Object.entries(bundle)) {
            if (output.type === "asset" && fileName.endsWith(".css")) {
              for (const matched of String(output.source).matchAll(
                /\.(bc[a-z0-9]+)/g,
              )) {
                knownNames.add(matched[1] as string);
              }
            }
          }
          if (knownNames.size === 0) {
            // 何も生成していないビルド（SSG の空クライアント環境など）は
            // 短縮をスキップするだけで、後続のルート CSS emit は行う
          } else {
            // 使用頻度は JS チャンク内の静的な出現回数を代理指標にする。
            // 実行時の描画回数は分からないが、全クラスが 1〜3 文字になるため
            // 順位の精度がサイズに与える影響は小さい
            const frequencies = new Map<string, number>(
              [...knownNames].map((name) => [name, 0]),
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

            renameMap = createRenameMap(frequencies);
            for (const [fileName, output] of Object.entries(bundle)) {
              if (output.type === "chunk") {
                output.code = applyRename(output.code, renameMap);
              } else if (fileName.endsWith(".css")) {
                output.source = applyRename(String(output.source), renameMap);
              }
            }

            // 確定した表を書き出し、後続のサーバービルドに共有する。
            // 「CSS を持つ環境」に限定する理由: SSG 等が走らせる空の
            // クライアント環境が、確定済みの表を上書きするのを防ぐため
            const mapPath = renameMapPath();
            const hasCss =
              routeStyledFiles.size > 0 ||
              Object.keys(bundle).some((fileName) => fileName.endsWith(".css"));
            if (mapPath !== null && hasCss) {
              fs.mkdirSync(path.dirname(mapPath), { recursive: true });
              fs.writeFileSync(
                mapPath,
                JSON.stringify(Object.fromEntries(renameMap), null, 2),
              );
            }
          }
        }

        // ルート単位 CSS の emit はリネーム表の確定後に行う（表を適用して出力）
        emitRouteCssAssets(this, bundle, renameMap);
      },
    },
  };
}
