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
        // sideEffects: false 宣言下でも CSS import を保持する（css-loader の定石）
        sideEffects: true,
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
          all: [{ not: "foreign" }, { not: { query: /bestcss/ } }],
        },
        loaders: [
          {
            loader: "@bestcss/webpack-loader",
            options: { importStyle: "query" },
          },
        ],
      },
      "*": {
        condition: { all: [{ not: "foreign" }, { query: /bestcss/ }] },
        loaders: ["@bestcss/webpack-loader/css"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

## カスケードレイヤー（@layer）

css`` 内で `@layer` を使う場合は、loader と最適化プラグインの両方に同じ `layers` を渡す（Turbopack では css loader 側の rule options にも）:

```js
use: [{ loader: "@bestcss/webpack-loader", options: { layers: ["base", "components", "utilities"] } }],
// ...
new BestCssWebpackPlugin({ layers: ["base", "components", "utilities"] }),
```

## ブラウザ対応（targets）

browserslist クエリを渡すと、ネストのフラット化とベンダープレフィックス付与が行われる（未指定ならプロジェクトの browserslist 設定を自動検出）。@layer と同様、loader と css loader の両方（Turbopack では rule options にも）に同じ値を渡す:

```js
use: [{ loader: "@bestcss/webpack-loader", options: { targets: "defaults" } }],
```

## 制限

- **Turbopack ではサイズ最適化（クラス名短縮・CSS 重複排除）が使えない** — Turbopack にはアセット後処理のフック（webpack の processAssets 相当）が存在しないため。内容ハッシュ名（`bc...`、9 文字程度）のまま配信される。抽出・ゼロランタイムは動作する
- SSR スイート（ルート単位分割・`routeCssHrefs`）は Vite 版のみ
- ファイルパスに `!` または `?` を含むファイルは扱えない（webpack のリクエスト構文と衝突するため明示的にエラーになる）

補足: `"sideEffects": false` を宣言したパッケージ内で css`` を使う場合は、上記 CSS ルールの `sideEffects: true` に加え、そのパッケージの宣言を `"sideEffects": ["**/*.css"]` にすること。
