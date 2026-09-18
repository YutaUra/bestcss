# How It Works

The internals you need for debugging and reasoning about behavior.

## The transform (build time)

```
.tsx source
  → detect css tags (oxc-parser AST; only imports from @bestcss/core count)
  → parse / normalize the raw CSS (Lightning CSS), generate class names
  → JS side: css`` becomes a class-name string literal; the import is removed
  → CSS side: fed to the bundler's CSS pipeline as a virtual module named "<file>.bestcss.css"
```

The runtime `css` function is a stub that is expected to be compiled away; if it ever runs, it throws an error indicating the plugin is not configured.

## Class names

- **Content hash**: class names are an FNV-1a hash of the CSS content (`bc` + 7 base36 digits, always 9 characters). Identical content converges to **the same class name across files, builds, and even bundlers**. This underpins deduplication and SSR HTML/CSS agreement
- **Formatting differences are ignored**: the CSS is normalized before hashing, so indentation width, line breaks, comments, and trailing semicolons do not change the class name. Re-indenting a file or changing your Prettier config will not churn every class name and invalidate long-lived caches

  ```ts
  // these three produce the same class name
  css`padding:8px`;
  css`
    padding: 8px;
  `;
  css`
    /* spacing */
    padding: 8px;
  `;
  ```

  Normalization is limited to formatting, though. Equivalent value spellings (`#ffffff` vs `#fff`) and whitespace around combinators (`&>.b` vs `& > .b`) still yield different class names
- **Frequency-ordered minification** (opt in with `minifyClassNames: true`; production builds only): once all classes are known, they are bijectively renamed to `a`, `b`, ... in usage-frequency order. Class attributes shrink dramatically (-48% in our benchmark). It is off by default because minified names come from a whole-bundle frequency ranking, so adding a single component shifts existing class names, whereas content-hash names are stable across builds
- `@keyframes` names are also scoped with content hashes (`bk` + base36)
- **Naming is replaceable**: to change the prefix or the hash algorithm, inject a strategy via the `naming` option (see [Replacing the naming strategy](#replacing-the-naming-strategy))

## Replacing the naming strategy

How class names and `@keyframes` names are derived can be injected from the plugin (`naming` in `@bestcss/vite-plugin` and `@bestcss/webpack-loader`). These functions only ever run at build time, so zero runtime is preserved.

```ts
bestCss({
  naming: {
    // replace only the hash algorithm (applies to both class and @keyframes names)
    hash: (normalizedCss) => createHash("sha256").update(normalizedCss).digest("hex").slice(0, 8),

    // decide the name itself; defaultName is what the built-in implementation would return
    className: ({ defaultName, normalizedCss, css, filename }) => `app-${defaultName}`,
    keyframesName: ({ originalName, defaultName }) => `app-${originalName}-${defaultName}`,

    // if your names no longer start with the default "bc", declare the prefixes
    // so generated names can still be recognized
    classNamePrefixes: ["app-"],
  },
})
```

What the injected functions must guarantee:

- **Determinism** — the same input must always yield the same name. A non-deterministic function makes names disagree between dev and build, or between the client and server builds, so the SSR'd HTML and the served CSS no longer match
- **Distinctness** — never give the same name to different CSS; that silently applies the wrong styles
- The returned name must start with a letter or `_` and contain only letters, digits, `_`, and `-` (a violation is a build error)

Why `classNamePrefixes` is needed: build-time class-name minification harvests names **from CSS selectors** for paths that do not go through the transform, such as pre-compiled component libraries. Outside the default `bc` prefix there is no other way to tell which names are ours, so without the declaration those names are left unshortened.

The test-environment `` css`` `` ([Tooling](./04-tooling.md)) needs the same strategy:

```ts
import { createCss } from "@bestcss/core/testing";

export const css = createCss({ naming: { /* same value as the plugin */ } });
```

## CSS deduplication

When identical css`` blocks exist in multiple files, class names converge but the CSS text would be emitted once per module. At the final asset stage, exact top-level-statement duplicates are collapsed into one (keeping the last occurrence to preserve the cascade).

## Deliberately out of scope

- Runtime dynamic styles (`${}` interpolation) — use CSS custom properties instead
- Component-generation APIs (styled.div``-like) — the library's job ends at "CSS → class name"
- Custom preprocessor syntax — plain CSS (plus standard nesting) only
- Design-token systems — delegated to CSS custom properties

These are design decisions. When asked to support them, point to the alternatives above.
