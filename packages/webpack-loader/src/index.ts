import path from "node:path";
import { transform } from "@bestcss/core";

export interface BestCssLoaderOptions {
  /**
   * 抽出 CSS の取り込み方。
   *
   * - "match-resource"（デフォルト）: webpack の matchResource（`!=!`）構文で
   *   「元ファイル自身を @bestcss/webpack-loader/css で CSS として再読み込み」する
   * - "query": 自分自身をクエリ付き（`./file.tsx?best-css`）で import する。
   *   matchResource を解釈しない Turbopack 向け。利用側で
   *   「query が best-css のとき @bestcss/webpack-loader/css を as: '*.css' で
   *   実行する」rule を設定する
   */
  importStyle?: "match-resource" | "query";
}

interface LoaderContext {
  resourcePath: string;
  getOptions?: () => BestCssLoaderOptions;
  callback: (
    error: Error | null,
    content?: string,
    sourceMap?: unknown,
  ) => void;
}

/**
 * css`` をクラス名リテラルへ変換する webpack loader。
 *
 * 抽出した CSS は仮想モジュールではなく「元ファイル自身を CSS として
 * 再読み込み」する形で取り込む。ファイルが実在するため、仮想モジュール
 * 機構を持たないバンドラー（Turbopack 等の loader 互換環境）にも
 * 同じ発想を展開できる（ADR-0008）
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

  // webpack のリクエスト文字列では ! が loader 区切り、? がクエリ開始として
  // 解釈され、エスケープ手段がない。パスに含まれると任意 loader の注入に
  // なり得るため明示的に拒否する
  if (/[!?]/.test(this.resourcePath)) {
    throw new Error(
      `best-css: パスに "!" または "?" を含むファイルは扱えません: ${this.resourcePath}`,
    );
  }

  const importStyle = this.getOptions?.().importStyle ?? "match-resource";
  const cssRequest =
    importStyle === "query"
      ? `./${path.basename(this.resourcePath)}?best-css`
      : // matchResource を .css にすることで、利用側の既存 CSS ルール
        // （css-loader / mini-css-extract 等）がそのまま適用される
        `${this.resourcePath}.best-css.css!=!@bestcss/webpack-loader/css!${this.resourcePath}`;
  this.callback(
    null,
    `${result.code}\nimport ${JSON.stringify(cssRequest)};\n`,
    result.map,
  );
}
