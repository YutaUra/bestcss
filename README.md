# best-css

ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化を「全部取り」する CSS ライブラリ。

## なぜこれが必要か

既存の CSS ライブラリはそれぞれ何かを犠牲にしている。tailwindcss はゼロランタイムと引き換えに HTML の class を肥大させ、styled-components はコロケーションと引き換えにランタイムコストを払い、vanilla-extract / panda-css はゼロランタイムと引き換えに生 CSS 文法を捨て、CSS Modules はファイル分割と引き換えにファイル往復を強いる。

best-css は、JSX 内に書いた生 CSS をビルド時に抽出・変換することで、これらのトレードオフを同時に解消することを目指す。詳細な思想は [docs/charter.md](docs/charter.md) を参照。

## 書き味

```tsx
// Button.tsx — CSS はコンポーネントの隣に、生 CSS 文法で書く
const button = css`
  padding: 8px 16px;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

ビルドすると CSS はファイルとして分割出力され、ランタイムには何も残らない。

### Reset CSS（opt-in）

必要な場合のみ、エントリファイルで import する（中身は [modern-normalize](https://github.com/sindresorhus/modern-normalize) への委譲）:

```ts
import "@best-css/core/reset.css";
```

自動注入にしていないのは、reset がコンポーネントスタイルより前に読み込まれる必要があり、import 順 = カスケード順をユーザーが制御できるべきだからである。別のリセットを使いたい場合は、これを import せず好きなものを直接 import すればよい。

## 書き方ガイド

### css`` 内に書けるもの

ネスト（`&:hover` 等）と条件付き at-rules（`@media` / `@supports` / `@container`）はそのままネストして書ける:

```ts
const card = css`
  padding: 16px;

  &:hover {
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
  }

  @media (min-width: 600px) {
    padding: 24px;
  }
`;
```

### グローバルな定義は通常の CSS ファイルに書く

`@keyframes`・デザイントークン（`:root` のカスタムプロパティ）・要素デフォルトは、クラスにスコープできないグローバルな存在なので、通常の `.css` ファイルに書いて import する（[examples/vite-react/src/global.css](examples/vite-react/src/global.css) 参照）。`@keyframes` を css`` 内に書くとビルドエラーになる（暗黙に無視しない）。

```css
/* global.css */
:root {
  --brand: #2563eb;
}
@keyframes pulse {
  50% { opacity: 0.5; }
}
```

```ts
const title = css`
  color: var(--brand);
  animation: pulse 2s infinite;
`;
```

### クラス合成の注意（CSS の一般則）

`` `${base} ${variant}` `` のような合成は可能だが、同一プロパティが衝突したときの勝敗は **className に並べた順ではなく、スタイルシート内でのルールの順** で決まる。ベースとバリアントで同じプロパティを両方に書かないのが安全。

### テスト（Vitest）

css`` はビルド時変換が前提のため、プラグインなしでテストを実行すると実行時エラーになる。Vitest は Vite ベースなので、`vitest.config.ts` に同じプラグインを並べるだけでよい:

```ts
import { bestCss } from "@best-css/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), bestCss()],
});
```

> **Status**: Phase 1（MVP）完了。Vite + React で css タグの抽出・HMR まで動作する。npm 未公開のため、試すには本リポジトリの examples を使う。進捗は [docs/plan.md](docs/plan.md) を参照。

## 試す

```sh
pnpm install
pnpm build                                 # packages/core と packages/vite-plugin をビルド
pnpm --filter example-vite-react dev       # サンプルアプリを起動
```

## 特徴（目標）

- **ゼロランタイム** — 実行時に CSS を生成するコードを一切出荷しない
- **HTML / CSS 両方のサイズ最適化** — class name の肥大と CSS の重複を両方防ぐ
- **コロケーション** — JSX の中に CSS を置き、スコープを明確にする
- **自然なファイル分割** — 巨大な単一 CSS ではなく、モジュール単位で分割・読み込み
- **生 CSS 文法** — タグ付きテンプレートに生の CSS をそのまま書ける。既存の CSS 資産を活用できる
- **Vite ファースト** — Vite プラグインとして簡単に統合（将来的に Next.js 等へも展開）

## ドキュメント

- [docs/charter.md](docs/charter.md) — このプロジェクトの存在意義・スコープ・撤退条件 🪨
- [docs/plan.md](docs/plan.md) — フェーズ・マイルストーン 🌀
- [docs/architecture.md](docs/architecture.md) — 技術スタック・設計判断 🌊
- [docs/decisions/](docs/decisions/) — Architecture Decision Records

## 貢献

現在は作者（[@YutaUra](https://github.com/YutaUra)）による個人開発フェーズ。思想が実証できた段階で OSS として公開し、貢献を受け入れる体制を整える予定。

## ライセンス

TBD（OSS 公開時に MIT を予定）
