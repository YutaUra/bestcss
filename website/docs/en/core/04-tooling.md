# Editor & Toolchain Integration

bestcss's css`` is designed so that the tag is literally named `css`, the contents are plain CSS syntax, and `${}` interpolation doesn't exist. Because of this, **the CSS-in-JS ecosystem built up since the styled-components era works almost as-is**. Not shipping a dedicated editor extension or lint plugin is a deliberate choice (we even rejected a derived-tag API like `css.layer()` to protect this compatibility — the reasoning is recorded in ADR-0012).

Every recipe on this page has been verified to work (as of Prettier 3.9 / stylelint 17.14 / Biome 2.5).

## Prettier — zero config

Prettier formats the contents of `css`-tagged templates **as CSS**. No plugins, no configuration:

```ts
// before
const button = css`
   padding:8px   16px;
  &:hover { opacity:.8 }
`;

// after prettier --write
const button = css`
  padding: 8px 16px;
  &:hover {
    opacity: 0.8;
  }
`;
```

Nesting and `@media` / `@layer` block indentation are normalized too.

## stylelint — one customSyntax line

Point customSyntax at [postcss-styled-syntax](https://github.com/hudochenkov/postcss-styled-syntax) and css`` contents are linted as CSS:

```sh
pnpm add -D stylelint stylelint-config-standard postcss-styled-syntax
```

```json
// .stylelintrc.json
{
  "extends": ["stylelint-config-standard"],
  "customSyntax": "postcss-styled-syntax"
}
```

```sh
stylelint "src/**/*.{ts,tsx}"
```

Typo'd property names and invalid values get caught before the build:

```
sample.tsx
   7:3   ✖  Expected empty line before at-rule            at-rule-empty-line-before
  11:10  ✖  Unknown value "#12345z" for property "color"  declaration-property-value-no-unknown
  12:3   ✖  Unknown property "paddin"                     property-no-unknown
```

`stylelint --fix` auto-fixes some rules. postcss-styled-syntax has machinery to treat `${}` interpolation as placeholders, but since bestcss forbids interpolation entirely, you get full-fidelity linting without that ambiguity.

## VS Code — the styled-components extension just works

The [vscode-styled-components](https://marketplace.visualstudio.com/items?itemName=styled-components.vscode-styled-components) extension recognizes the `css` tag by convention, so bestcss's css`` gets syntax highlighting, property completion, and hover docs.

The official [stylelint VS Code extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) reads the same `.stylelintrc.json`, giving you in-editor squiggles. It only validates CSS files by default, so add TypeScript:

```json
// .vscode/settings.json
{
  "stylelint.validate": ["css", "typescript", "typescriptreact"]
}
```

## Other editors — the TypeScript plugin

[typescript-styled-plugin](https://github.com/styled-components/typescript-styled-plugin) provides CSS completion and error reporting as a TypeScript language-service plugin. Any editor that uses tsserver (Neovim, JetBrains, Zed, ...) gets it without an editor-side extension:

```sh
pnpm add -D typescript-styled-plugin
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "typescript-styled-plugin" }]
  }
}
```

Language-service plugins don't affect `tsc` builds (editor experience only). Build-time validation is built in — syntax errors fail the transform via Lightning CSS, so broken CSS never ships even without lint in CI.

## A note for Biome users

Biome (as of 2.5) **does not format embedded CSS inside tagged templates** (css`` contents are left untouched — never mangled). If you want Biome for JS/TS formatting plus formatted css``, run Prettier alongside as the CSS formatter, or skip embedded-CSS formatting and rely on stylelint for linting only.

## AI coding agents

Each bestcss package ships this entire docs directory inside the npm package. Point agents at `node_modules/@bestcss/*/docs/` instead of their training data, so they work from **information that always matches the installed version**. A single line in your project's CLAUDE.md or AGENTS.md does it:

```md
When working with bestcss, consult node_modules/@bestcss/core/docs/
and node_modules/@bestcss/vite-plugin/docs/.
```

## Related pages

- Sourcemap setup for jumping from browser DevTools to the css`` source → [Vite setup](/en/vite/)
- Running tests with Vitest → [Vite setup](/en/vite/)
- The `layers` option required for `@layer` → [css`` syntax](/en/core/01-syntax)
- Typo detection for design tokens (CSS variables) → [CSS Variables & Design Tokens](/en/core/05-css-variables)
