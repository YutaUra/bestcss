# @bestcss/vite-plugin ドキュメント

このディレクトリはパッケージに同梱されており、インストールされているバージョンと常に一致する。**css`` の文法や内部のしくみは [core のドキュメント](../../core/docs/index.md)**（`node_modules/@bestcss/core/docs/`）を参照。

## セットアップ

```sh
pnpm add @bestcss/core
pnpm add -D @bestcss/vite-plugin
```

```ts
// vite.config.ts
import { bestCss } from "@bestcss/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), bestCss()],
  css: { devSourcemap: true }, // 任意: DevTools から css`` の元位置へ辿れる
});
```

```tsx
import { css } from "@bestcss/core";

const button = css`
  padding: 8px 16px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

書ける文法の詳細は [core: css`` の文法](../../core/docs/01-syntax.md)。

## オプション

```ts
bestCss({
  minifyClassNames?: boolean,        // デフォルト false（opt-in）
  ssr?: boolean | { routesDir?: string },
  layers?: string[],                 // カスケードレイヤーの順序（下位 → 上位）
  targets?: string | string[] | false, // 対応ブラウザ（browserslist クエリ）
  naming?: NamingStrategy,           // クラス名 / @keyframes 名の決め方
})
```

- **minifyClassNames** — 本番ビルドでクラス名を使用頻度順の短い名前（`a`, `b`, ...）へ振り直す（ベンチで class 属性 -48%、合計 gzip -14%）。**opt-in**（既定は無効）で、既定では内容ハッシュ名（`bc...`）のまま出荷される。短縮名はバンドル全体の頻度順で決まるため、コンポーネントを 1 つ足すだけで既存クラスの名前がずれる — 内容ハッシュ名はビルドを跨いで安定するので、長期キャッシュを崩さない側を既定にしている。サイズを詰める本番ビルドで `true` にする
- **ssr** — SSR プロジェクトの宣言。[SSR / MPA 統合](./01-ssr.md) を参照
- **layers** — css`` 内で `@layer name { ... }` を使うための順序宣言。使用する名前はすべて宣言が必要（詳細は [core: css`` の文法](../../core/docs/01-syntax.md)）
- **targets** — ネストのフラット化・ベンダープレフィックス付与の対象ブラウザ。未指定ならプロジェクトの browserslist 設定を自動検出、`false` で無効化（詳細は [core: css`` の文法](../../core/docs/01-syntax.md)）
- **naming** — クラス名 / `@keyframes` 名の決め方。未指定なら「正規化した内容の FNV-1a ハッシュ + `bc` / `bk` 接頭辞」。注入する関数は決定的でなければならず、テスト実行環境の `` css`` `` にも同じ値を渡す（詳細は [core: 仕組み](../../core/docs/02-how-it-works.md)）

## テスト（Vitest）

css`` はビルド時変換が前提のため、プラグインなしでテストを実行すると実行時エラーになる。`vitest.config.ts` に同じプラグインを並べる:

```ts
import { bestCss } from "@bestcss/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [bestCss()],
});
```

## CSS のコード分割

抽出した CSS は Vite のチャンクグラフに乗るため、Vite 標準のチャンク制御がそのまま使える:

- `build.cssCodeSplit: false` — 全 CSS を 1 ファイルに集約
- `build.rollupOptions.output.codeSplitting` — 仮想 CSS の id は「元ファイルパス + `.bestcss.css`」なので、`test` 正規表現でディレクトリ・ファイル名単位のグループ化ができる
- 動的 `import()` 境界で CSS も遅延ロードされる

## トラブルシューティング

- 変換対象は `@bestcss/core` から `css` を import しているファイルのみ
- 「css`` が実行時に呼ばれました」エラー = プラグイン未設定の環境でコードが実行された（素の Vitest 等）。上記のテスト設定を参照

## コンポーネントライブラリを配布する

bestcss で書いた UI ライブラリの npm 配布はプリコンパイル配布を推奨する。[コンポーネントライブラリの配布](./02-library.md) を参照。

## 制限: sideEffects: false のパッケージ内で使う場合

注入される CSS import は side-effect import のため、`"sideEffects": false` を宣言したパッケージ（コンポーネントライブラリ等）の中ではツリーシェイクで落とされる。CSS を side effect として明示すること:

```json
{ "sideEffects": ["**/*.css"] }
```
