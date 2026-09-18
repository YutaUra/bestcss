# @bestcss/webpack-loader

[bestcss](https://github.com/YutaUra/bestcss) の webpack / Next.js（Turbopack）統合。loader と、サイズ最適化プラグインを提供します。

**📖 ドキュメント**: https://yutaura.github.io/bestcss/webpack/ （[English](https://yutaura.github.io/bestcss/en/webpack/)）

## セットアップ（webpack）

```sh
pnpm add @bestcss/core
pnpm add -D @bestcss/webpack-loader
```

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
        sideEffects: true, // sideEffects: false 宣言下でも CSS import を保持する
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    // CSS の重複排除は常に行う。クラス名の頻度順短縮は
    // minifyClassNames: true で opt-in（既定は内容ハッシュ名のまま）
    new BestCssWebpackPlugin({ minifyClassNames: true }),
  ],
};
```

loader は抽出 CSS を matchResource（`!=!`）構文で「元ファイル自身の CSS としての再読み込み」として取り込むため、既存の CSS ルール（css-loader / mini-css-extract）がそのまま適用されます。

## Next.js（Turbopack）

Turbopack は matchResource を解釈しないため、`importStyle: "query"` を使います。設定例は [Next.js（Turbopack）](https://yutaura.github.io/bestcss/webpack/#next-js-turbopack) を参照してください。

**制限**: Turbopack にはアセット後処理のフック（webpack の `processAssets` 相当）が無いため、サイズ最適化（クラス名短縮・CSS 重複排除）は使えません。抽出とゼロランタイムは動作します。

## 同梱ドキュメント

使い方の正典は**このパッケージに同梱されたドキュメント**で、インストールしたバージョンと常に一致します（`node_modules/@bestcss/webpack-loader/docs/`）。webpack / Next.js のセットアップ、カスケードレイヤー、ブラウザ対応、SSR、Jest、既知の制限を扱っています。

`` css`...` `` に書ける文法は [@bestcss/core のドキュメント](https://yutaura.github.io/bestcss/core/01-syntax) を参照してください。

## ライセンス

MIT
