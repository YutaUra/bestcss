# css`` の文法

## 書けるもの

生の CSS 宣言に加え、ネストと条件付き at-rules がそのまま書ける:

```ts
const card = css`
  padding: 16px;

  &:hover {
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
  }

  @media (min-width: 600px) {
    padding: 24px;
  }

  @supports (display: grid) {
    display: grid;
  }
`;
```

## @keyframes はスコープ付きで書ける

ブロック直下に書いた `@keyframes` は内容ハッシュで命名し直され、名前が衝突しない。参照（`animation` / `animation-name`）は**同一ファイル内**のブロック間で解決される:

```ts
const title = css`
  animation: pulse 2s infinite;

  @keyframes pulse {
    50% { opacity: 0.5; }
  }
`;
```

## 書けないもの

### `${}` 補間 — ビルドエラー

```ts
// ❌ 型エラー + ビルドエラーになる
const bad = css`color: ${color};`;
```

ランタイム動的スタイルは設計上サポートしない。動的な値は CSS カスタムプロパティで表現する:

```tsx
const box = css`background: var(--box-color);`;

<div className={box} style={{ "--box-color": color } as React.CSSProperties} />
```

### グローバルな定義 — 通常の CSS ファイルへ

`:root` のデザイントークンや要素デフォルトはクラスにスコープできないため、通常の `.css` ファイルに書いて import する:

```css
/* global.css */
:root {
  --brand: #2563eb;
}
```

```ts
const title = css`color: var(--brand);`;
```

## クラス合成の注意（CSS の一般則）

`` `${base} ${variant}` `` のような className 上の合成は可能だが、同一プロパティが衝突したときの勝敗は **className に並べた順ではなく、スタイルシート内でのルールの順** で決まる。ベースとバリアントで同じプロパティを両方に書かないこと。

```tsx
const base = css`padding: 8px 16px; border-radius: 6px;`;
const primary = css`background: #2563eb; color: #fff;`;

<button className={`${base} ${primary}`} />
```
