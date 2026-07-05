import path from "node:path";
import { transform } from "@bestcss/core";
import { resolveTargetsCached } from "./resolve-targets.js";

export interface BestCssLoaderOptions {
  /**
   * 抽出 CSS の取り込み方。
   *
   * - "match-resource"（デフォルト）: webpack の matchResource（`!=!`）構文で
   *   「元ファイル自身を @bestcss/webpack-loader/css で CSS として再読み込み」する
   * - "query": 自分自身をクエリ付き（`./file.tsx?bestcss`）で import する。
   *   matchResource を解釈しない Turbopack 向け。利用側で
   *   「query が bestcss のとき @bestcss/webpack-loader/css を as: '*.css' で
   *   実行する」rule を設定する
   */
  importStyle?: "match-resource" | "query";
  /**
   * カスケードレイヤーの順序宣言（下位 → 上位）。css`` 内で
   * `@layer name { ... }` を使う場合は必須。Turbopack（importStyle:
   * "query"）では css loader 側の rule にも同じ options を指定すること
   */
  layers?: string[];
  /**
   * 対応ブラウザの browserslist クエリ。指定するとネストのフラット化や
   * ベンダープレフィックス付与などのダウンレベルが行われる。
   * 未指定ならプロジェクトの browserslist 設定を自動検出し、
   * 設定もなければダウンレベルしない（モダンブラウザ前提）。
   * false で自動検出ごと無効化する。Turbopack（importStyle: "query"）では
   * css loader 側の rule にも同じ options を指定すること
   */
  targets?: string | string[] | false;
}

interface LoaderContext {
  resourcePath: string;
  rootContext?: string;
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
  const options = this.getOptions?.() ?? {};
  const result = transform(source, {
    filename: this.resourcePath,
    layers: options.layers,
    targets: resolveTargetsCached(
      options.targets,
      this.rootContext ?? process.cwd(),
    ),
  });
  if (result === null) {
    this.callback(null, source);
    return;
  }

  // webpack のリクエスト文字列では ! が loader 区切り、? がクエリ開始として
  // 解釈され、エスケープ手段がない。パスに含まれると任意 loader の注入に
  // なり得るため明示的に拒否する
  if (/[!?]/.test(this.resourcePath)) {
    throw new Error(
      `bestcss: パスに "!" または "?" を含むファイルは扱えません: ${this.resourcePath}`,
    );
  }

  const importStyle = options.importStyle ?? "match-resource";
  // css loader 側にも layers / targets を伝える（webpack の loader クエリは
  // JSON 形式で getOptions に渡る）。matchResource 文字列にはオプション指定の
  // 口が無いため。targets は解決後の Targets ではなく生のクエリを渡し、
  // css loader 側で同じ手順（キャッシュ込み）で解決させる
  const cssLoaderOptions: Record<string, unknown> = {};
  if (options.layers !== undefined) {
    cssLoaderOptions["layers"] = options.layers;
  }
  if (options.targets !== undefined) {
    cssLoaderOptions["targets"] = options.targets;
  }
  const cssLoader =
    Object.keys(cssLoaderOptions).length === 0
      ? "@bestcss/webpack-loader/css"
      : `@bestcss/webpack-loader/css?${JSON.stringify(cssLoaderOptions)}`;
  const cssRequest =
    importStyle === "query"
      ? `./${path.basename(this.resourcePath)}?bestcss`
      : // matchResource を .css にすることで、利用側の既存 CSS ルール
        // （css-loader / mini-css-extract 等）がそのまま適用される
        `${this.resourcePath}.bestcss.css!=!${cssLoader}!${this.resourcePath}`;
  this.callback(
    null,
    `${result.code}\nimport ${JSON.stringify(cssRequest)};\n`,
    result.map,
  );
}
