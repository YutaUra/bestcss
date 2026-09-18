# @bestcss/vite-plugin

[bestcss](https://github.com/YutaUra/bestcss) の Vite プラグイン。`` css`...` `` の抽出・HMR・クラス名短縮・SSR / ルート単位 CSS 分割を担います。

**📖 ドキュメント**: https://yutaura.github.io/bestcss/vite/ （[English](https://yutaura.github.io/bestcss/en/vite/)）

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

## オプション

```ts
bestCss({
  minifyClassNames?: boolean,           // デフォルト false（opt-in）
  ssr?: boolean | { routesDir?: string },
  layers?: string[],                    // カスケードレイヤーの順序（下位 → 上位）
  targets?: string | string[] | false,  // 対応ブラウザ（browserslist クエリ）
  naming?: NamingStrategy,              // クラス名 / @keyframes 名の決め方
})
```

各オプションの詳細は [オプション](https://yutaura.github.io/bestcss/vite/#オプション) を参照してください。

## 同梱ドキュメント

使い方の正典は**このパッケージに同梱されたドキュメント**で、インストールしたバージョンと常に一致します（`node_modules/@bestcss/vite-plugin/docs/`）。

| ページ | 内容 |
|---|---|
| [セットアップとオプション](https://yutaura.github.io/bestcss/vite/) | 導入・オプション・Vitest・CSS コード分割 |
| [SSR / MPA 統合](https://yutaura.github.io/bestcss/vite/01-ssr) | HonoX などでの SSR・ルート単位 CSS 配信 |
| [ライブラリの配布](https://yutaura.github.io/bestcss/vite/02-library) | bestcss で書いた UI ライブラリを npm 配布する |

`` css`...` `` に書ける文法は [@bestcss/core のドキュメント](https://yutaura.github.io/bestcss/core/01-syntax) を参照してください。

## ライセンス

MIT
