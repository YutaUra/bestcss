# bestcss Documentation (@bestcss/core)

bestcss is a CSS library that delivers zero runtime, colocation, plain CSS syntax, and size optimization — all at once. It extracts `` css`...` `` written inside your JSX at build time and turns it into class-name string literals. **No CSS-generating code is shipped at runtime.**

These docs are also bundled inside the `@bestcss/core` npm package (`node_modules/@bestcss/core/docs/`), so AI coding agents always see documentation that matches the installed version.

## Contents (core: bundler-agnostic)

1. [css`` syntax — what you can and cannot write](/en/core/01-syntax)
2. [How it works (class names, optimization, debugging)](/en/core/02-how-it-works)
3. [Migrating from Tailwind / UnoCSS](/en/core/03-migrate-from-utility-frameworks)

## Bundler integrations

Setup and build configuration live with each integration package:

- **Vite**: [@bestcss/vite-plugin](/en/vite/) — setup, options, SSR / MPA integration
- **webpack / Next.js (Turbopack)**: [@bestcss/webpack-loader](/en/webpack/)

## Reset CSS (opt-in)

Import it in your entry file only if you want it (it delegates to modern-normalize):

```ts
import "@bestcss/core/reset.css";
```

It is not auto-injected because the reset must load before component styles — import order equals cascade order, and that should stay under your control.

## Key points for agents

- Import `css` from `@bestcss/core`. **`${}` interpolation is not allowed** (rejected at the type level and at build time). Express dynamic values with CSS custom properties plus the style attribute
- Proposals that break zero runtime (e.g. runtime style generation) are out of the question by design
- Global definitions (`:root` tokens, element defaults) go into a regular `.css` file, not css``
