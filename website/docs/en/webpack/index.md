# webpack / Next.js (Turbopack)

Use `@bestcss/webpack-loader`. The same transform core (`@bestcss/core`) as the Vite plugin runs underneath. For css`` syntax and internals, see the [core docs](/en/core/).

## webpack

```js
// webpack.config.js
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { BestCssWebpackPlugin } from "@bestcss/webpack-loader/plugin";

export default {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: ["@bestcss/webpack-loader"],
      },
      {
        test: /\.css$/,
        // keep CSS imports alive under sideEffects: false (standard css-loader practice)
        sideEffects: true,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin(),
    // size optimization (frequency-ordered class minification + CSS dedup)
    new BestCssWebpackPlugin(),
  ],
};
```

The loader pulls extracted CSS in via the matchResource (`!=!`) syntax — "re-read the source file itself as CSS" — so your existing CSS rules (css-loader / mini-css-extract) apply unchanged.

## Next.js (Turbopack)

Turbopack doesn't understand matchResource, so integrate via `importStyle: "query"` and `turbopack.rules`:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.tsx": {
        condition: {
          all: [{ not: "foreign" }, { not: { query: /bestcss/ } }],
        },
        loaders: [
          {
            loader: "@bestcss/webpack-loader",
            options: { importStyle: "query" },
          },
        ],
      },
      "*": {
        condition: { all: [{ not: "foreign" }, { query: /bestcss/ }] },
        loaders: ["@bestcss/webpack-loader/css"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

## Cascade layers (@layer)

To use `@layer` inside css``, pass the same `layers` to both the loader and the optimization plugin (and to the css loader's rule options on Turbopack):

```js
use: [{ loader: "@bestcss/webpack-loader", options: { layers: ["base", "components", "utilities"] } }],
// ...
new BestCssWebpackPlugin({ layers: ["base", "components", "utilities"] }),
```

## Browser support (targets)

Pass a browserslist query to enable nesting flattening and vendor prefixing (the project browserslist config is auto-detected when omitted). Like `layers`, pass the same value to both the loader and the css loader (and to the rule options on Turbopack):

```js
use: [{ loader: "@bestcss/webpack-loader", options: { targets: "defaults" } }],
```

## Limitations

- **Size optimization (class minification / CSS dedup) is unavailable on Turbopack** — it has no post-bundle asset hook (webpack's processAssets equivalent). Content-hash names (`bc...`, ~9 chars) ship instead. Extraction and zero runtime work fine
- The SSR suite (per-route splitting, `routeCssHrefs`) is Vite-only for now
- File paths containing `!` or `?` are rejected explicitly (they collide with webpack request syntax)
- Inside a package declaring `"sideEffects": false`, also declare `"sideEffects": ["**/*.css"]` in addition to the css rule's `sideEffects: true` above
