# SSR / MPA Integration

Target: Vite-based frameworks with a two-pass client → server build, such as HonoX.

## Setup

Pass the same `ssr` option to **both** the client and server build configs:

```ts
// vite.config.ts (shared by client / server)
bestCss({ ssr: { routesDir: "app/routes" } })
// without per-route CSS splitting:
bestCss({ ssr: true })
```

This enables, internally:

1. **Automatic sharing of the class-rename map across builds** — SSR'd HTML and served CSS agree on minified names. Build client → server (violations fail loudly)
2. **No CSS imports in the SSR build** — the server bundle only needs class names; serving CSS is the client build's job
3. **Per-route CSS splitting** (with `routesDir`) — route-specific CSS ships only on that route; shared CSS ships as shared files

## Injecting `<link>` in your renderer

```tsx
// app/routes/_renderer.tsx
import { routeCssHrefs } from "@bestcss/vite-plugin/route-css";

{routeCssHrefs(c.req.path).map((href) => (
  <link href={href} rel="stylesheet" />
))}
```

The route→CSS manifest is inlined at build time — no runtime file access, works on serverless.

Limitation: dynamic segments (`$id` etc.) are not matched yet.

## Dev style serving (nothing extra needed with routesDir)

In dev, `routeCssHrefs` returns dev URLs (`?direct`, served by Vite as raw CSS) computed by walking your routes. **The renderer's `<link>` covers dev and prod alike**, independent of islands or any client entry — pure SSR apps with no client JS just work. Edits are picked up automatically (full reload for link-only styles; regular HMR when the style is also in the client JS graph).

If you don't use routesDir, a one-line virtual import in your client entry collects all route styles in dev (and becomes empty in production builds):

```ts
// app/client.ts (only without routesDir)
import "virtual:bestcss/dev-styles";
```

Add the virtual-module types to tsconfig:

```json
{ "compilerOptions": { "types": ["vite/client", "@bestcss/vite-plugin/client"] } }
```

## Minimal setup: pure SSR without islands (HonoX)

Even with no hydration, all you need is `ssr: { routesDir }` in vite.config plus the renderer:

```tsx
// app/routes/_renderer.tsx
import { routeCssHrefs } from "@bestcss/vite-plugin/route-css";

{routeCssHrefs(c.req.path).map((href) => (
  <link href={href} rel="stylesheet" />
))}
```

No client entry, no dev-only entry. Dev and prod use the same path.

## Opting out of the rename map

With `minifyClassNames: false`, output keeps content-hash names (`bc...`). Content hashes agree deterministically across independent builds, so HTML and CSS match without sharing a map (see [How it works](/en/core/02-how-it-works)).
