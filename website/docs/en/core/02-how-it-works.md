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

- **Content hash**: class names are an FNV-1a hash of the CSS content (`bc` + base36). Identical content converges to **the same class name across files, builds, and even bundlers**. This underpins deduplication and SSR HTML/CSS agreement
- **Frequency-ordered minification** (production builds only): once all classes are known, they are bijectively renamed to `a`, `b`, ... in usage-frequency order. Class attributes shrink dramatically (-48% in our benchmark)
- `@keyframes` names are also scoped with content hashes (`bk` + base36)

## CSS deduplication

When identical css`` blocks exist in multiple files, class names converge but the CSS text would be emitted once per module. At the final asset stage, exact top-level-statement duplicates are collapsed into one (keeping the last occurrence to preserve the cascade).

## Deliberately out of scope

- Runtime dynamic styles (`${}` interpolation) — use CSS custom properties instead
- Component-generation APIs (styled.div``-like) — the library's job ends at "CSS → class name"
- Custom preprocessor syntax — plain CSS (plus standard nesting) only
- Design-token systems — delegated to CSS custom properties

These are design decisions. When asked to support them, point to the alternatives above.
