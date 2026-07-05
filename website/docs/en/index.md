---
layout: home

hero:
  name: bestcss
  text: The have-it-all CSS library
  tagline: Zero runtime × colocation × plain CSS syntax × size optimization
  actions:
    - theme: brand
      text: Get Started
      link: /en/vite/
    - theme: alt
      text: Why bestcss
      link: /en/core/
    - theme: alt
      text: GitHub
      link: https://github.com/YutaUra/bestcss

features:
  - icon: 🪶
    title: Zero runtime
    details: Ships no CSS-generating code at runtime. css`` in your JSX becomes a plain class-name string at build time
  - icon: 📍
    title: Colocation × plain CSS
    details: Write CSS next to your component, in real CSS syntax. Nesting, @media, and scoped @keyframes supported
  - icon: 📦
    title: Optimizes both HTML and CSS
    details: One or two classes per element plus frequency-ordered class-name minification cut class attributes roughly in half. Identical styles are deduplicated automatically
  - icon: 🔌
    title: Vite / webpack / Next.js
    details: Vite-first, with a loader for webpack and Next.js (Turbopack). Per-route CSS splitting for SSR / MPA included
---

## The feel, in 30 seconds

```tsx
import { css } from "@bestcss/core";

const button = css`
  padding: 8px 16px;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

After the build, `button` is a short class-name string like `"a"`, and the CSS is emitted as split files. Nothing ships at runtime.

```sh
pnpm add @bestcss/core
pnpm add -D @bestcss/vite-plugin
```
