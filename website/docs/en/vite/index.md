# Vite Plugin (@bestcss/vite-plugin)

For css`` syntax and internals, see the [core docs](/en/core/).

## Setup

```sh
pnpm add @bestcss/core
pnpm add -D @bestcss/vite-plugin
```

```ts
// vite.config.ts
import { bestCss } from "@bestcss/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), bestCss()],
  css: { devSourcemap: true }, // optional: DevTools links point at your css`` source
});
```

```tsx
import { css } from "@bestcss/core";

const button = css`
  padding: 8px 16px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

See [css`` syntax](/en/core/01-syntax) for what you can write.

## Options

```ts
bestCss({
  minifyClassNames?: boolean,        // default: true
  ssr?: boolean | { routesDir?: string },
  layers?: string[],                 // cascade layer order (lowest → highest)
  targets?: string | string[] | false, // supported browsers (browserslist query)
})
```

- **minifyClassNames** — renames classes to short, frequency-ordered names (`a`, `b`, ...) in production builds. Dev always uses content-hash names (`bc...`). Set `false` when you need class names stable across builds (e.g. long-cached SSR HTML)
- **ssr** — declares an SSR project. See [SSR / MPA integration](/en/vite/01-ssr)
- **layers** — layer-order declaration required to use `@layer name { ... }` inside css``. Every name used must be declared (see [css`` syntax](/en/core/01-syntax))
- **targets** — target browsers for nesting flattening / vendor prefixing. Auto-detects the project browserslist config when omitted; `false` disables (see [css`` syntax](/en/core/01-syntax))

## Testing (Vitest)

css`` requires the build-time transform; running tests without the plugin throws at runtime. Vitest is Vite-based, so list the same plugin:

```ts
import { bestCss } from "@bestcss/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [bestCss()],
});
```

## CSS code splitting

Extracted CSS rides Vite's chunk graph, so standard Vite chunk controls apply:

- `build.cssCodeSplit: false` — bundle all CSS into one file
- `build.rollupOptions.output.codeSplitting` — virtual CSS ids are "source file path + `.bestcss.css`", so `test` regexes can group by directory or file name
- CSS lazy-loads along dynamic `import()` boundaries

## Troubleshooting

- Only files importing `css` from `@bestcss/core` are transformed
- "css`` was called at runtime" means code ran without the plugin (plain Vitest, etc.) — see the test setup above

## Limitation: packages that declare sideEffects: false

Injected CSS imports are side-effect imports, so inside a package declaring `"sideEffects": false` (component libraries, etc.) they get tree-shaken away. Declare CSS as a side effect:

```json
{ "sideEffects": ["**/*.css"] }
```
