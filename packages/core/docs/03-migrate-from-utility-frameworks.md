# Tailwind / UnoCSS からの移行

## Preflight → modern-normalize の差分に注意

`@bestcss/core/reset.css` は modern-normalize に委譲している。Tailwind / UnoCSS の **Preflight は modern-normalize より広範なリセット**を行うため、乗り換えると次の差分で見た目が崩れる:

| Preflight がやること | modern-normalize | 崩れ方 |
|---|---|---|
| `h1..h6, p, dl, dd` 等の margin を 0 に | しない | 既定の margin が復活する |
| `a { color: inherit; text-decoration: none }` | しない | リンクが既定の青下線に戻る |
| `* { border-width: 0; border-style: solid }` | しない | `border-width: 1px` だけでは枠線が出ない（`border: 1px solid ...` と **style まで明示**が必要） |

## 対処: base 層で明示補完する

利用側のグローバル CSS（[グローバルな定義の書き方](./01-syntax.md)）で、依存していた分だけ明示する:

```css
@import "@bestcss/core/reset.css";

/* Preflight 相当を必要な分だけ補完する */
h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd {
  margin: 0;
}
a {
  color: inherit;
  text-decoration: none;
}
```

border は補完せず、css`` 側で `border: 1px solid ...` と書くのを推奨する（暗黙の `border-style` 前提はコードの可搬性を下げる）。

## class 属性の移行

ユーティリティの列挙は 1 つの css`` ブロックに置き換える:

```tsx
// before (Tailwind)
<button className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:opacity-80" />

// after
const button = css`
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;

  &:hover {
    opacity: 0.8;
  }
`;
<button className={button} />
```

theme() 由来の値はデザイントークン（`:root` のカスタムプロパティ）+ `var()` に移す。
