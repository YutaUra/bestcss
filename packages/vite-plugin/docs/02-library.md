# コンポーネントライブラリの配布

bestcss で書いた UI ライブラリを npm 配布するときは、**プリコンパイル配布**（ビルド時に抽出済みの JS + CSS を出荷する）を使う。利用側に bestcss の設定は不要になる。

## ライブラリ作者側

Vite の lib モードでビルドし、**クラス名の短縮は無効にする**:

```ts
// vite.config.ts（ライブラリ側）
export default defineConfig({
  plugins: [bestCss({ minifyClassNames: false })],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
  },
});
```

`minifyClassNames: false` にする理由: 短縮名（a, b, c...）はビルドローカルな頻度順で、ライブラリが短縮名を出荷すると利用側アプリの短縮名と衝突する。**bc 名は内容ハッシュ（内容アドレス）なので衝突せず**、最終的な短縮は利用側ビルドに委ねられる。

package.json では CSS の export と sideEffects を宣言する:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./style.css": "./dist/index.css"
  },
  "sideEffects": ["**/*.css"]
}
```

`sideEffects: ["**/*.css"]` がないと、`sideEffects: false` 相当の扱いで CSS import がツリーシェイクされて消える。

## 利用側

コンポーネントと CSS を import するだけで、**bestcss の設定は不要**:

```ts
import "your-ui/style.css";
import { Button } from "your-ui";
```

利用側も bestcss を使っている場合はさらに合流が起きる:

- **同一スタイルの重複排除**: ライブラリとアプリに同じ宣言があると、内容ハッシュにより同一クラス名へ収束し、配信 CSS では 1 ルールになる
- **ライブラリのクラス名も短縮対象**: 利用側の本番ビルドは CSS アセットのセレクタからも bc 名を収穫するため、ライブラリ由来のクラスも a, b, c... へ短縮され、JS と CSS の一貫性が保たれる（webpack 利用側でも `BestCssWebpackPlugin` が同じことを行う）

この合流はどちらも契約としてテストで担保している（`library-dist.test.ts`）。

## ソース配布（css`` のまま出荷）は非対応

変換は node_modules 内のファイルをスキップするため、css`` を含むソースをそのまま配布しても利用側で抽出されない。意図的な設計で、理由は:

- 利用側に bestcss の導入・バージョン整合を強制することになる
- dev サーバーの依存事前バンドル（optimizeDeps）は プラグインの変換を通らず、css`` が実行時エラーになる組み合わせが生まれる

「ライブラリの境界でスタイルは確定している」というプリコンパイル配布の方が、ゼロランタイムの思想とも整合する。
