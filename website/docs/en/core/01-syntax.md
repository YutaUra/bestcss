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

## Cascade layers (@layer)

Write `@layer name { ... }` as plain CSS at the top level of a block. This makes composition outcomes deterministic — decided by **layer order** rather than output order:

```ts
const base = css`
  @layer components {
    padding: 8px 16px;
    background: gray;
  }
`;

const override = css`
  @layer utilities {
    background: red; /* always beats components, regardless of output order */
  }
`;
```

The plugin config owns the layer order (lowest → highest). **Using an undeclared name is a build error** (this structurally eliminates first-appearance-order nondeterminism):

```ts
bestCss({ layers: ["base", "components", "utilities"] })
```

Plain css`` (unlayered) still beats every layer, as before. We deliberately did not add a JS API like `css.layer()`: changing the tag away from `css` breaks embedded-CSS recognition in Prettier, stylelint, and editor extensions (verified empirically) — plain CSS syntax keeps the whole toolchain working.

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

Composing like `` `${base} ${variant}` `` works, but when the same property conflicts, the winner is decided by **rule order in the stylesheet, not the order in className**. Avoid writing the same property in both base and variant — or use @layer above, putting the base in a lower layer and the variant in a higher one for output-order-independent determinism.

```tsx
const base = css`padding: 8px 16px; border-radius: 6px;`;
const primary = css`background: #2563eb; color: #fff;`;

<button className={`${base} ${primary}`} />
```
