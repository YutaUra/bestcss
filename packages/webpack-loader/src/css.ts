import { transform } from "@bestcss/core";
import { resolveTargetsCached } from "./resolve-targets.js";

interface LoaderContext {
  resourcePath: string;
  rootContext?: string;
  getOptions?: () => {
    layers?: string[];
    targets?: string | string[] | false;
  };
}

/**
 * 元ファイル（css`` を含む tsx 等）を受け取り、抽出した CSS テキストを
 * 返す loader。メイン loader が発行する matchResource import
 * （`<file>.bestcss.css!=!@bestcss/webpack-loader/css!<file>`）から使われる
 */
export default function bestCssCssLoader(
  this: LoaderContext,
  source: string,
): string {
  const options = this.getOptions?.() ?? {};
  const result = transform(source, {
    filename: this.resourcePath,
    layers: options.layers,
    targets: resolveTargetsCached(
      options.targets,
      this.rootContext ?? process.cwd(),
    ),
  });
  // css`` を含まない入力はそのまま返す（冪等）。Turbopack は as: "*.css" の
  // 適用後にルールを再評価することがあり、2 周目の入力は抽出済みの
  // CSS テキストになるため、素通しできないと空になってしまう
  return result?.css ?? source;
}
