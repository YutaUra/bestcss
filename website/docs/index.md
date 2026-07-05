---
layout: home

hero:
  name: bestcss
  text: 全部取りの CSS ライブラリ
  tagline: ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化
  actions:
    - theme: brand
      text: はじめる
      link: /vite/
    - theme: alt
      text: なぜ bestcss か
      link: /core/
    - theme: alt
      text: GitHub
      link: https://github.com/YutaUra/bestcss

features:
  - icon: 🪶
    title: ゼロランタイム
    details: 実行時に CSS を生成するコードを一切出荷しない。JSX に書いた css`` はビルド時にクラス名の文字列になる
  - icon: 📍
    title: コロケーション × 生 CSS 文法
    details: CSS をコンポーネントの隣に、生の CSS 文法で書ける。ネスト・@media・スコープ付き @keyframes に対応
  - icon: 📦
    title: HTML / CSS 両方のサイズ最適化
    details: 1 要素 1〜2 クラス + 頻度順のクラス名短縮で class 属性を約半分に。同一スタイルは自動で重複排除
  - icon: 🔌
    title: Vite / webpack / Next.js
    details: Vite ファースト。webpack と Next.js (Turbopack) にも loader で対応。SSR / MPA のルート単位 CSS 分割も
---

## 30 秒で見る書き味

```tsx
import { css } from "@bestcss/core";

const button = css`
  padding: 8px 16px;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

ビルドすると `button` は `"a"` のような短いクラス名文字列になり、CSS はファイルとして分割出力される。ランタイムには何も残らない。

```sh
pnpm add @bestcss/core
pnpm add -D @bestcss/vite-plugin
```
