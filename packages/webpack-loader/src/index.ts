import { transform } from "@best-css/core";

interface LoaderContext {
  resourcePath: string;
  callback: (
    error: Error | null,
    content?: string,
    sourceMap?: unknown,
  ) => void;
}

/**
 * css`` をクラス名リテラルへ変換する webpack loader。
 *
 * 抽出した CSS は仮想モジュールではなく、matchResource 構文（`!=!`）で
 * 「元ファイル自身を @best-css/webpack-loader/css で CSS として再読み込み」
 * する形で取り込む。ファイルが実在するため、仮想モジュール機構を持たない
 * バンドラー（Turbopack 等の loader 互換環境）にも同じ発想を展開できる
 * （vanilla-extract の webpack 統合と同じ確立されたパターン）
 */
export default function bestCssLoader(
  this: LoaderContext,
  source: string,
): void {
  const result = transform(source, { filename: this.resourcePath });
  if (result === null) {
    this.callback(null, source);
    return;
  }
  // matchResource を .css にすることで、利用側の既存 CSS ルール
  // （css-loader / mini-css-extract 等）がそのまま適用される
  const cssRequest = `${this.resourcePath}.best-css.css!=!@best-css/webpack-loader/css!${this.resourcePath}`;
  this.callback(
    null,
    `${result.code}\nimport ${JSON.stringify(cssRequest)};\n`,
    result.map,
  );
}
