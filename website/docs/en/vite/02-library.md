# Distributing Component Libraries

When publishing a UI library written with bestcss to npm, use **precompiled distribution** — ship the extracted JS + CSS built at pack time. Consumers then need no bestcss setup at all.

## On the library side

Build with Vite's lib mode and **disable class-name minification**:

```ts
// vite.config.ts (library)
export default defineConfig({
  plugins: [bestCss({ minifyClassNames: false })],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
  },
});
```

Why `minifyClassNames: false`: minified names (a, b, c...) are build-local frequency rankings — a library shipping them would collide with the consumer app's own minified names. **bc names are content hashes (content-addressed), so they never collide**, and final minification is delegated to the consumer's build.

Declare the CSS export and sideEffects in package.json:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./style.css": "./dist/index.css"
  },
  "sideEffects": ["**/*.css"]
}
```

Without `sideEffects: ["**/*.css"]`, the CSS import gets tree-shaken away.

## On the consumer side

Just import the component and the CSS — **no bestcss setup required**:

```ts
import "your-ui/style.css";
import { Button } from "your-ui";
```

If the consumer also uses bestcss, convergence kicks in:

- **Duplicate styles collapse**: identical declarations in the library and the app converge to the same class name via content hashing, producing a single rule in shipped CSS
- **Library class names get minified too**: the consumer's production build also harvests bc names from CSS asset selectors, so library classes get renamed to a, b, c... consistently across JS and CSS (`BestCssWebpackPlugin` does the same for webpack consumers)

Both behaviors are locked in as contracts by tests (`library-dist.test.ts`).

## Source distribution (shipping raw css``) is unsupported

The transform skips files inside node_modules, so shipping source with css`` won't get extracted on the consumer side. This is deliberate:

- It would force consumers to install bestcss and keep versions aligned
- The dev server's dependency pre-bundling (optimizeDeps) bypasses plugin transforms, creating combinations where css`` throws at runtime

Precompiled distribution — "styles are settled at the library boundary" — also aligns better with the zero-runtime philosophy.
