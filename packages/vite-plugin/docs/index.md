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
  minifyClassNames?: boolean,        // デフォルト true
  ssr?: boolean | { routesDir?: string },
})
```

- **minifyClassNames** — 本番ビルドでクラス名を使用頻度順の短い名前（`a`, `b`, ...）へ振り直す。dev では常に内容ハッシュ名（`bc...`）。`false` は SSR した HTML を長期キャッシュする等、ビルド間の名前安定性を優先したい場合
- **ssr** — SSR プロジェクトの宣言。[SSR / MPA 統合](./01-ssr.md) を参照

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
