import fs from "node:fs";
import path from "node:path";
import { applyRename, createRenameMap, dedupeCss } from "@bestcss/core";

export interface BestCssWebpackPluginOptions {
  /**
   * ビルド時にクラス名を使用頻度順の短い名前（a, b, ...）へ振り直す。
   *
   * @default true
   */
  minifyClassNames?: boolean;
  /**
   * カスケードレイヤーの順序宣言（loader の layers と同じ値を渡す）。
   * 最終 CSS アセットの先頭に権威ある完全な順序宣言を付与し、
   * minifier による切り詰めから順序を守る
   */
  layers?: string[];
  /**
   * SSR プロジェクト（client / server の 2 つのコンパイル）であることを
   * 宣言する。両方のコンパイルに同じ値を渡す。
   *
   * CSS アセットを持つコンパイル（client）がリネーム表を
   * node_modules/.bestcss/rename-map.json に書き出し、持たない
   * コンパイル（server）は表に従って JS を書き換える。SSR された HTML と
   * 配信 CSS の短縮名を一致させるため（ビルドは client → server の順）。
   * Vite プラグインの ssr オプションと同じ仕組み（ADR-0006）
   */
  ssr?: boolean;
}

// webpack の型に依存しない構造型。プラグインは compiler.webpack 経由で
// API を受け取るため、webpack を import せずに済む（peer 依存も不要）
interface AssetSource {
  source: { source: () => string | Buffer };
}

interface CompilationLike {
  hooks: {
    processAssets: {
      tap: (
        options: { name: string; stage: number },
        handler: (assets: Record<string, unknown>) => void,
      ) => void;
    };
  };
  getAsset: (name: string) => AssetSource | undefined;
  updateAsset: (name: string, source: unknown) => void;
}

interface CompilerLike {
  context: string;
  webpack: {
    Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE: number };
    sources: { RawSource: new (source: string) => unknown };
  };
  hooks: {
    thisCompilation: {
      tap: (name: string, handler: (compilation: CompilationLike) => void) => void;
    };
  };
}

const PLUGIN_NAME = "BestCssWebpackPlugin";

/**
 * Vite 版の generateBundle 相当のサイズ最適化を webpack で行うプラグイン。
 * CSS アセットの重複ルール排除と、クラス名の頻度順短縮（ADR-0004）。
 *
 * 生成クラス名の一覧は loader と状態を共有せず、CSS アセットのセレクタ
 * （.bc...）から集める。loader が別プロセス・別インスタンスで動いても
 * 自己完結するため。
 *
 * Turbopack にはアセット後処理のフックが存在しないため、このプラグインは
 * webpack ビルド専用（Turbopack では内容ハッシュ名のまま配信される）
 */
export class BestCssWebpackPlugin {
  private readonly minifyClassNames: boolean;
  private readonly layers: string[] | undefined;
  private readonly ssr: boolean;

  constructor(options: BestCssWebpackPluginOptions = {}) {
    this.minifyClassNames = options.minifyClassNames ?? true;
    this.layers = options.layers;
    this.ssr = options.ssr ?? false;
  }

  apply(compiler: CompilerLike): void {
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        (assets) => {
          const readAsset = (name: string): string =>
            compilation.getAsset(name)?.source.source().toString() ?? "";
          const cssNames = Object.keys(assets).filter((n) =>
            n.endsWith(".css"),
          );

          for (const name of cssNames) {
            let source = readAsset(name);
            // minifier による順序宣言の切り詰めから守るため、
            // 権威ある完全な宣言を先頭に付与する
            if (this.layers !== undefined && source.includes("@layer")) {
              source = `@layer ${this.layers.join(", ")};\n${source}`;
            }
            compilation.updateAsset(
              name,
              new sources.RawSource(dedupeCss(source)),
            );
          }

          if (!this.minifyClassNames) {
            return;
          }

          const mapPath = path.resolve(
            compiler.context,
            "node_modules/.bestcss/rename-map.json",
          );

          // CSS アセットを持たないコンパイル = サーバービルド。
          // 自分の頻度で短縮すると client と一致しないため、共有された
          // 表に従って JS だけを書き換える（Vite 版と同じ役割分担）
          if (this.ssr && cssNames.length === 0) {
            if (!fs.existsSync(mapPath)) {
              throw new Error(
                `bestcss: リネーム表 ${mapPath} が見つかりません。` +
                  `表は CSS アセットを持つクライアントビルドが書き出すため、` +
                  `クライアントビルドを先に実行してください。`,
              );
            }
            const sharedMap = new Map(
              Object.entries(
                JSON.parse(fs.readFileSync(mapPath, "utf8")) as Record<
                  string,
                  string
                >,
              ),
            );
            for (const name of Object.keys(assets).filter((n) =>
              n.endsWith(".js") || n.endsWith(".cjs") || n.endsWith(".mjs"),
            )) {
              compilation.updateAsset(
                name,
                new sources.RawSource(applyRename(readAsset(name), sharedMap)),
              );
            }
            return;
          }

          const generated = new Set<string>();
          for (const name of cssNames) {
            for (const matched of readAsset(name).matchAll(
              /\.(bc[a-z0-9]+)/g,
            )) {
              generated.add(matched[1] as string);
            }
          }
          if (generated.size === 0) {
            return;
          }

          const jsNames = Object.keys(assets).filter((n) => n.endsWith(".js"));
          const frequencies = new Map<string, number>(
            [...generated].map((name) => [name, 0]),
          );
          for (const name of jsNames) {
            for (const matched of readAsset(name).matchAll(
              /\bbc[a-z0-9]+\b/g,
            )) {
              const count = frequencies.get(matched[0]);
              if (count !== undefined) {
                frequencies.set(matched[0], count + 1);
              }
            }
          }

          const renameMap = createRenameMap(frequencies);
          for (const name of [...jsNames, ...cssNames]) {
            compilation.updateAsset(
              name,
              new sources.RawSource(applyRename(readAsset(name), renameMap)),
            );
          }

          // 確定した表を後続のサーバービルドへ共有する
          if (this.ssr) {
            fs.mkdirSync(path.dirname(mapPath), { recursive: true });
            fs.writeFileSync(
              mapPath,
              JSON.stringify(Object.fromEntries(renameMap), null, 2),
            );
          }
        },
      );
    });
  }
}
