# Migrating from Tailwind / UnoCSS

## Watch out: Preflight → modern-normalize differences

`@bestcss/core/reset.css` delegates to modern-normalize. Tailwind / UnoCSS **Preflight resets far more than modern-normalize does**, so switching breaks these things:

| What Preflight does | modern-normalize | What breaks |
|---|---|---|
| Zeroes margins on `h1..h6, p, dl, dd`, etc. | Doesn't | Default margins come back |
| `a { color: inherit; text-decoration: none }` | Doesn't | Links revert to default blue underline |
| `* { border-width: 0; border-style: solid }` | Doesn't | `border-width: 1px` alone draws nothing — you must **spell out the style**: `border: 1px solid ...` |

## Fix: fill in the base layer explicitly

In your global CSS ([where global definitions go](/en/core/01-syntax)), add exactly what you depended on:

```css
@import "@bestcss/core/reset.css";

/* Fill in the Preflight behavior you actually relied on */
h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd {
  margin: 0;
}
a {
  color: inherit;
  text-decoration: none;
}
```

For borders, prefer writing `border: 1px solid ...` in css`` rather than restoring the global default — implicit `border-style` assumptions hurt portability.

## Migrating class attributes

Replace utility lists with a single css`` block:

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

Move theme() values to design tokens (`:root` custom properties) referenced with `var()`.
