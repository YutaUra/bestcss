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
    // CSS の重複排除は常に行う。クラス名の頻度順短縮は
    // minifyClassNames: true で opt-in（既定は内容ハッシュ名のまま）
    new BestCssWebpackPlugin({ minifyClassNames: true }),
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

## 命名を差し替える（naming）

クラス名 / `@keyframes` 名の決め方は loader の `naming` オプションで注入する（指定できる内容は [core: 仕組み](../../core/docs/02-how-it-works.md) を参照）。既定の `bc` 接頭辞から外れた名前にする場合は、短縮対象をセレクタから収穫するためプラグインにも接頭辞を宣言する:

```js
const naming = {
  className: ({ defaultName }) => `app-${defaultName}`,
  classNamePrefixes: ["app-"],
};

export default {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [{ loader: "@bestcss/webpack-loader", options: { naming } }],
      },
    ],
  },
  plugins: [new BestCssWebpackPlugin({ classNamePrefixes: ["app-"] })],
};
```

@layer / targets と違い、css loader 側に同じ値を渡す必要はない（関数は JSON クエリで運べないため、loader 間でモジュールスコープの表を通して共有している）。ただし Turbopack（`importStyle: "query"`）では css loader の rule にも同じ `naming` を指定できる。

## webpack で SSR する

client / server の 2 コンパイル構成で `minifyClassNames: true` にする場合は、短縮名の一致を `ssr: true` で取る（既定の内容ハッシュ名なら表の共有もビルド順の制約も不要）。CSS アセットを持つクライアントビルドがリネーム表を `node_modules/.bestcss/rename-map.json` へ書き出し、サーバービルドは表に従って書き換える（**ビルドは client → server の順**。Vite 版と同じ仕組み）:

```js
// クライアント側 config
plugins: [new BestCssWebpackPlugin({ ssr: true })],

// サーバー側 config
module: {
  rules: [{
    test: /\.[jt]sx?$/,
    exclude: /node_modules/,
    // サーバーは CSS を配信しないため import を発行しない
    use: [{ loader: "@bestcss/webpack-loader", options: { emitCss: false } }],
  }],
},
plugins: [new BestCssWebpackPlugin({ ssr: true })],
```

表がない状態でサーバービルドするとエラーメッセージで順序を案内する。

**Next.js での位置づけ**: Turbopack ではルート単位の CSS 分割・配信を Next 自身が行い、クラス名は内容ハッシュのまま（短縮なし）なので SSR された HTML と CSS は最初から一致する — 追加の設定は不要。webpack モードの Next.js は client / server のコンパイルが並列に走るため client → server の順序契約を満たせない。短縮が必要なら Turbopack を使うこと。

## テスト（Jest）

Jest はビルド変換を通さないため、`@bestcss/core/testing` へ差し替える（詳細は [core: エディタとツールチェーンの活用](../../core/docs/04-tooling.md)）。

## 制限

- **命名戦略（naming）は loader を同一プロセスで動かす構成が前提** — css loader へのオプションはリクエスト文字列の JSON クエリで渡るため関数を運べず、命名戦略はモジュールスコープの表で loader 間を受け渡している。`thread-loader` などで loader を別プロセスに分けると JS 側と CSS 側のクラス名が食い違う
- **命名戦略で `bc` 接頭辞から外れた名前にする場合は、プラグインにも `classNamePrefixes` を渡す** — 短縮対象は CSS アセットのセレクタから収穫するため、宣言がないと短縮が効かない
- **Turbopack ではサイズ最適化（クラス名短縮・CSS 重複排除）が使えない** — Turbopack にはアセット後処理のフック（webpack の processAssets 相当）が存在しないため。内容ハッシュ名（`bc...`、9 文字程度）のまま配信される。抽出・ゼロランタイムは動作する
- ルート単位の CSS 分割（`routeCssHrefs`）は Vite 版のみ（Next.js はフレームワーク自身が行うため不要）。SSR でのクラス名短縮の一致は上記 `ssr: true` で対応
- ファイルパスに `!` または `?` を含むファイルは扱えない（webpack のリクエスト構文と衝突するため明示的にエラーになる）

補足: `"sideEffects": false` を宣言したパッケージ内で css`` を使う場合は、上記 CSS ルールの `sideEffects: true` に加え、そのパッケージの宣言を `"sideEffects": ["**/*.css"]` にすること。
