# @bestcss/webpack-loader ドキュメント

このディレクトリはパッケージに同梱されており、インストールされているバージョンと常に一致する。**css`` の文法や内部のしくみは [core のドキュメント](../../core/docs/index.md)**（`node_modules/@bestcss/core/docs/`）を参照。

Vite 版と同じ変換コア（`@bestcss/core`）が動く。

## webpack

```js
// webpack.config.js
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { BestCssWebpackPlugin } from "@bestcss/webpack-loader/plugin";

export default {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: ["@bestcss/webpack-loader"],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    // サイズ最適化（クラス名の頻度順短縮 + CSS の重複排除）
    new BestCssWebpackPlugin(),
  ],
};
```

loader は抽出 CSS を matchResource（`!=!`）構文で「元ファイル自身の CSS としての再読み込み」として取り込むため、既存の CSS ルール（css-loader / mini-css-extract）がそのまま適用される。

## Next.js（Turbopack）

Turbopack は matchResource を解釈しないため、`importStyle: "query"` と `turbopack.rules` で統合する:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.tsx": {
        condition: {
          all: [{ not: "foreign" }, { not: { query: /best-css/ } }],
        },
        loaders: [
          {
            loader: "@bestcss/webpack-loader",
            options: { importStyle: "query" },
          },
        ],
      },
      "*": {
        condition: { all: [{ not: "foreign" }, { query: /best-css/ }] },
        loaders: ["@bestcss/webpack-loader/css"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

## 制限

- **Turbopack ではサイズ最適化（クラス名短縮・CSS 重複排除）が使えない** — Turbopack にはアセット後処理のフック（webpack の processAssets 相当）が存在しないため。内容ハッシュ名（`bc...`、9 文字程度）のまま配信される。抽出・ゼロランタイムは動作する
- SSR スイート（ルート単位分割・`routeCssHrefs`）は Vite 版のみ
- ファイルパスに `!` または `?` を含むファイルは扱えない（webpack のリクエスト構文と衝突するため明示的にエラーになる）
