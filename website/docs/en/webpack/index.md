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

## SSR with webpack

For client / server two-compilation setups, keep minified class names consistent with `ssr: true`. The compilation that owns CSS assets (client) writes a rename map to `node_modules/.bestcss/rename-map.json`, and the server compilation rewrites its JS from that map (**build client → server, in that order** — same mechanism as the Vite plugin):

```js
// client config
plugins: [new BestCssWebpackPlugin({ ssr: true })],

// server config
module: {
  rules: [{
    test: /\.[jt]sx?$/,
    exclude: /node_modules/,
    // the server doesn't serve CSS, so don't emit the import
    use: [{ loader: "@bestcss/webpack-loader", options: { emitCss: false } }],
  }],
},
plugins: [new BestCssWebpackPlugin({ ssr: true })],
```

Building the server without the map fails with an error explaining the ordering contract.

**Where Next.js stands**: on Turbopack, Next itself handles per-route CSS splitting and delivery, and class names stay content-hashed (no minification), so SSR'd HTML and CSS match from the start — no extra setup. Next.js in webpack mode runs client / server compilations in parallel, which cannot satisfy the client → server ordering contract; use Turbopack if you need minification.

## Testing (Jest)

Jest doesn't run the build transform, so remap to `@bestcss/core/testing` (see [core: Editor & Toolchain Integration](/en/core/04-tooling)).

## Limitations

- **Size optimization (class minification / CSS dedup) is unavailable on Turbopack** — it has no post-bundle asset hook (webpack's processAssets equivalent). Content-hash names (`bc...`, ~9 chars) ship instead. Extraction and zero runtime work fine
- Per-route CSS splitting (`routeCssHrefs`) is Vite-only (Next.js does it natively, so it isn't needed there). SSR class-name consistency is covered by `ssr: true` above
- File paths containing `!` or `?` are rejected explicitly (they collide with webpack request syntax)
- Inside a package declaring `"sideEffects": false`, also declare `"sideEffects": ["**/*.css"]` in addition to the css rule's `sideEffects: true` above
