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

## カスケードレイヤー（@layer）

`@layer name { ... }` を生 CSS 構文としてブロック直下に書ける。合成の勝敗を「出力順」ではなく「レイヤー順」で決定的にできる:

```ts
const base = css`
  @layer components {
    padding: 8px 16px;
    background: gray;
  }
`;

const override = css`
  @layer utilities {
    background: red; /* 出力順に関係なく components に必ず勝つ */
  }
`;
```

レイヤー順はプラグイン設定が所有する（下位 → 上位）。**設定にない名前の使用はビルドエラー**になる（「初出順」依存の非決定性を排除するため）:

```ts
bestCss({ layers: ["base", "components", "utilities"] })
```

未指定の css``（unlayered）は従来どおり全レイヤーに勝つ。JS 側の API（`css.layer()` など）にしていないのは、タグ名が `css` から変わると Prettier / stylelint / エディタ拡張の埋め込み CSS 認識がすべて外れることを実測で確認したため — 生 CSS 構文ならツールチェーンが素通しになる。

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

`` `${base} ${variant}` `` のような className 上の合成は可能だが、同一プロパティが衝突したときの勝敗は **className に並べた順ではなく、スタイルシート内でのルールの順** で決まる。ベースとバリアントで同じプロパティを両方に書かないこと。あるいは上記の @layer を使い、ベースを下位・バリアントを上位のレイヤーに置けば出力順に依存せず決定的になる。

```tsx
const base = css`padding: 8px 16px; border-radius: 6px;`;
const primary = css`background: #2563eb; color: #fff;`;

<button className={`${base} ${primary}`} />
```
