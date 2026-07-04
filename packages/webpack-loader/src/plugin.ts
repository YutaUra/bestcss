import { applyRename, createRenameMap, dedupeCss } from "@bestcss/core";

export interface BestCssWebpackPluginOptions {
  /**
   * ビルド時にクラス名を使用頻度順の短い名前（a, b, ...）へ振り直す。
   *
   * @default true
   */
  minifyClassNames?: boolean;
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

  constructor(options: BestCssWebpackPluginOptions = {}) {
    this.minifyClassNames = options.minifyClassNames ?? true;
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
            compilation.updateAsset(
              name,
              new sources.RawSource(dedupeCss(readAsset(name))),
            );
          }

          if (!this.minifyClassNames) {
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
        },
      );
    });
  }
}
