# @bestcss/core

ゼロランタイム CSS-in-JS のバンドラー非依存な変換コア。`` css`...` `` タグをビルド時にクラス名と CSS へ変換する。

[bestcss](https://github.com/YutaUra/bestcss) は、ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化を「全部取り」することを目指す CSS ライブラリです。

**📖 ドキュメント**: https://yutaura.github.io/bestcss/core/ （[English](https://yutaura.github.io/bestcss/en/core/)）

## インストール

このパッケージ単体では動きません。バンドラー統合とあわせて入れてください。

```sh
# Vite
pnpm add @bestcss/core && pnpm add -D @bestcss/vite-plugin

# webpack / Next.js
pnpm add @bestcss/core && pnpm add -D @bestcss/webpack-loader
```

## 書き味

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

ビルド後、`` css`...` `` はクラス名の文字列リテラルに置き換わり、CSS は `.css` ファイルとして出力されます。**出荷バンドルに CSS 生成コードは一切残りません。**

## Reset CSS（opt-in）

```ts
import "@bestcss/core/reset.css";
```

中身は [modern-normalize](https://github.com/sindresorhus/modern-normalize) への委譲です。自動注入にしていないのは、import 順 = カスケード順を利用者が制御できるべきだからです。

## 同梱ドキュメント

使い方の正典は**このパッケージに同梱されたドキュメント**で、インストールしたバージョンと常に一致します（`node_modules/@bestcss/core/docs/`）。

| ページ | 内容 |
|---|---|
| [css`` の文法](https://yutaura.github.io/bestcss/core/01-syntax) | ネスト・`@media`・`@keyframes`・`@layer` |
| [内部のしくみ](https://yutaura.github.io/bestcss/core/02-how-it-works) | クラス名の決まり方・重複排除・命名の差し替え |
| [ユーティリティ CSS からの移行](https://yutaura.github.io/bestcss/core/03-migrate-from-utility-frameworks) | tailwindcss などからの移行 |
| [ツール連携](https://yutaura.github.io/bestcss/core/04-tooling) | エディタ・Jest などのテストランナー |
| [CSS 変数](https://yutaura.github.io/bestcss/core/05-css-variables) | デザイントークンの扱い |
| [動的なスタイル](https://yutaura.github.io/bestcss/core/06-dynamic-styles) | 状態に応じたスタイルの書き方 |

## AI コーディングエージェントと使う

プロジェクトの `AGENTS.md` / `CLAUDE.md` に一文入れておくと、エージェントが学習データではなく同梱ドキュメントを参照します。詳しくは [リポジトリの README](https://github.com/YutaUra/bestcss#ai-エージェントと使う) を参照してください。

## ライセンス

MIT
