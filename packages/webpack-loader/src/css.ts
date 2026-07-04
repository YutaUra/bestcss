import { transform } from "@best-css/core";

interface LoaderContext {
  resourcePath: string;
}

/**
 * 元ファイル（css`` を含む tsx 等）を受け取り、抽出した CSS テキストを
 * 返す loader。メイン loader が発行する matchResource import
 * （`<file>.best-css.css!=!@best-css/webpack-loader/css!<file>`）から使われる
 */
export default function bestCssCssLoader(
  this: LoaderContext,
  source: string,
): string {
  const result = transform(source, { filename: this.resourcePath });
  return result?.css ?? "";
}
