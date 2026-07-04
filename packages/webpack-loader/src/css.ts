import { transform } from "@bestcss/core";

interface LoaderContext {
  resourcePath: string;
}

/**
 * 元ファイル（css`` を含む tsx 等）を受け取り、抽出した CSS テキストを
 * 返す loader。メイン loader が発行する matchResource import
 * （`<file>.best-css.css!=!@bestcss/webpack-loader/css!<file>`）から使われる
 */
export default function bestCssCssLoader(
  this: LoaderContext,
  source: string,
): string {
  const result = transform(source, { filename: this.resourcePath });
  // css`` を含まない入力はそのまま返す（冪等）。Turbopack は as: "*.css" の
  // 適用後にルールを再評価することがあり、2 周目の入力は抽出済みの
  // CSS テキストになるため、素通しできないと空になってしまう
  return result?.css ?? source;
}
