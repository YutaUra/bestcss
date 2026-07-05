# CSS Variables & Design Tokens

bestcss does **nothing special** for CSS variables (custom properties). A `var(--x)` inside css`` is extracted as plain CSS, untouched. That's by design, not neglect: because the build never resolves variables for you, everything CSS variables natively do — theme switching, inheritance, the cascade — keeps working as-is.

In exchange, CSS variables carry two roles in bestcss's design:

1. **The only path for dynamic values** — `${}` interpolation is forbidden, so runtime-varying values go through CSS variables + the style attribute (see [css`` syntax](/en/core/01-syntax))
2. **The home for design tokens** — one place for colors, spacing, and typography

## Keep design tokens in CSS variables

`:root` can't be scoped to a class, so it can't live inside css``. Define tokens in a regular CSS file and import it from your entry:

```css
/* tokens.css */
:root {
  --color-primary: #2563eb;
  --color-text: #111;
  --space-md: 16px;
}
```

```ts
// main.tsx (entry)
import "./tokens.css";
```

Components just reference them with `var()` inside css``:

```ts
const card = css`
  color: var(--color-text);
  padding: var(--space-md);
`;
```

The advantage of CSS variables over build-time constants (interpolating TS constants) is that **switching values is pure CSS**. A dark theme is a variable override — component css`` doesn't change at all:

```css
/* append to tokens.css */
[data-theme="dark"] {
  --color-text: #eee;
}
```

## Catching typos

A typo like `var(--colr-primary)` is not an error per the CSS spec (an undefined variable just resolves to unset), and the build passes. So detection comes from the ecosystem.

### stylelint — detect references to undefined variables

Point [stylelint-value-no-unknown-custom-properties](https://github.com/csstools/stylelint-value-no-unknown-custom-properties) at your token file via `importFrom` (the base setup for linting inside css`` is in [Editor & Toolchain Integration](/en/core/04-tooling)):

```sh
pnpm add -D stylelint-value-no-unknown-custom-properties
```

```json
// .stylelintrc.json (adds plugins & rules to the 04-tooling setup)
{
  "extends": ["stylelint-config-standard"],
  "customSyntax": "postcss-styled-syntax",
  "plugins": ["stylelint-value-no-unknown-custom-properties"],
  "rules": {
    "csstools/value-no-unknown-custom-properties": [
      true,
      { "importFrom": ["src/tokens.css"] }
    ]
  }
}
```

Referencing a variable that isn't in tokens.css gets flagged (verified):

```
vars.tsx
  9:14  ✖  Unexpected custom property "--colr-primary" inside declaration "color".
           csstools/value-no-unknown-custom-properties
```

**Caveat**: a reference with a fallback like `var(--foo, 8px)` is considered intentional and is exempt from detection. This dovetails nicely with a simple rule of thumb: no fallback on token references (keeps typo detection active), always a fallback on externally-injected dynamic variables (nothing breaks if the style attribute forgets to pass one).

Also, `custom-property-pattern` from `stylelint-config-standard` enforces a naming convention (kebab-case by default), preventing a mix of `--colorPrimary` and `--color-primary`.

### Editor — completion and go-to-definition

The [CSS Variables](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables) VS Code extension collects variable definitions from `**/*.css` in your project (tokens.css included) and lists `typescript` / `typescriptreact` among its supported languages, so **completion, color previews, and go-to-definition (Cmd+click to tokens.css) work inside css``**. Typing `var(--` shows the full token list, so typos rarely happen in the first place.

## Combining with dynamic values

Runtime-varying values are injected via the style attribute, using the same `var()` syntax as tokens:

```tsx
const bar = css`
  width: var(--progress, 0%);
  background: var(--color-primary);
`;

<div
  className={bar}
  style={{ "--progress": `${percent}%` } as React.CSSProperties}
/>;
```

Static tokens (`--color-primary`) and dynamic values (`--progress`) ride the same mechanism, so inside css`` you never think about where build time ends and runtime begins. Put a fallback on the dynamic side only, and a missed injection won't break layout.

## Related pages

- Why `${}` interpolation is forbidden, and how globals work → [css`` syntax](/en/core/01-syntax)
- The stylelint / editor base setup → [Editor & Toolchain Integration](/en/core/04-tooling)
