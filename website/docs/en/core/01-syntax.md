# css`` Syntax

## What you can write

Plain CSS declarations, plus nesting and conditional at-rules:

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

## Scoped @keyframes

`@keyframes` written at the top level of a block is renamed with a content hash, so names never collide. References (`animation` / `animation-name`) are resolved across blocks **within the same file**:

```ts
const title = css`
  animation: pulse 2s infinite;

  @keyframes pulse {
    50% { opacity: 0.5; }
  }
`;
```

## What you cannot write

### `${}` interpolation — build error

```ts
// ❌ type error + build error
const bad = css`color: ${color};`;
```

Runtime dynamic styles are unsupported by design. Express dynamic values with CSS custom properties:

```tsx
const box = css`background: var(--box-color);`;

<div className={box} style={{ "--box-color": color } as React.CSSProperties} />
```

### Global definitions — use a regular CSS file

`:root` design tokens and element defaults cannot be scoped to a class, so put them in a regular `.css` file and import it:

```css
/* global.css */
:root {
  --brand: #2563eb;
}
```

```ts
const title = css`color: var(--brand);`;
```

## A note on class composition (general CSS rule)

Composing like `` `${base} ${variant}` `` works, but when the same property conflicts, the winner is decided by **rule order in the stylesheet, not the order in className**. Avoid writing the same property in both base and variant.

```tsx
const base = css`padding: 8px 16px; border-radius: 6px;`;
const primary = css`background: #2563eb; color: #fff;`;

<button className={`${base} ${primary}`} />
```
