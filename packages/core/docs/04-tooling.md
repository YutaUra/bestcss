# エディタとツールチェーンの活用

bestcss の css`` は「タグ名が `css` そのもの」「中身が生 CSS 文法」「`${}` 補間なし」という設計のため、**styled-components 時代から積み上がった CSS-in-JS エコシステムの資産がほぼそのまま効く**。専用のエディタ拡張や lint プラグインを作らないのは意図的な判断である（この互換性を守るために `css.layer()` のような派生タグ API を見送った経緯も含め、設計判断は ADR-0012 に記録されている）。

このページの設定例はすべて動作を実測して確認している（Prettier 3.9 / stylelint 17.14 / Biome 2.5 時点）。

## Prettier — 設定不要

Prettier は `css` タグ付きテンプレートの中身を **CSS として整形する**。プラグインも設定も不要:

```ts
// 整形前
const button = css`
   padding:8px   16px;
  &:hover { opacity:.8 }
`;

// prettier --write 後
const button = css`
  padding: 8px 16px;
  &:hover {
    opacity: 0.8;
  }
`;
```

ネストや `@media` / `@layer` ブロックのインデントも揃う。

## stylelint — customSyntax を 1 行足す

[postcss-styled-syntax](https://github.com/hudochenkov/postcss-styled-syntax) を customSyntax に指定すると、css`` の中身が CSS としてリントされる:

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

これで typo したプロパティ名や不正な値がビルド前に捕まる:

```
sample.tsx
   7:3   ✖  Expected empty line before at-rule            at-rule-empty-line-before
  11:10  ✖  Unknown value "#12345z" for property "color"  declaration-property-value-no-unknown
  12:3   ✖  Unknown property "paddin"                     property-no-unknown
```

`stylelint --fix` による自動修正も一部のルールで効く。なお postcss-styled-syntax は `${}` 補間をプレースホルダーとして扱う仕組みを持つが、bestcss は補間自体を禁止しているため、その曖昧さなしにフル機能でリントできる。

## VS Code — styled-components 拡張がそのまま効く

[vscode-styled-components](https://marketplace.visualstudio.com/items?itemName=styled-components.vscode-styled-components) 拡張は `css` タグを認識する規約なので、bestcss の css`` にもシンタックスハイライト・プロパティ補完・ホバードキュメントが効く。

stylelint の [公式 VS Code 拡張](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) は上の `.stylelintrc.json` をそのまま読むため、エディタ内に赤線が出る。デフォルトでは CSS ファイルしか検証しないので、TypeScript を対象に足す:

```json
// .vscode/settings.json
{
  "stylelint.validate": ["css", "typescript", "typescriptreact"]
}
```

## VS Code 以外のエディタ — TypeScript プラグイン

[typescript-styled-plugin](https://github.com/styled-components/typescript-styled-plugin) は TypeScript 言語サービスのプラグインとして CSS の補完・エラー表示を提供する。tsserver を使うエディタ（Neovim、JetBrains、Zed など）ならエディタ側の拡張なしで効く:

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

言語サービスのプラグインは `tsc` のビルドには影響しない（エディタ体験のみ）。ビルド時の検証はビルトインで行われる — 構文エラーは Lightning CSS が変換時に落とすため、CI で lint を回していなくても壊れた CSS が出荷されることはない。

## Biome を使っている場合の注意

Biome（2.5 時点）は **タグ付きテンプレート内の埋め込み CSS を整形しない**（css`` の中身は触らずに残る。壊すことはない）。JS/TS の整形を Biome に任せつつ css`` の整形が欲しい場合は、Prettier を CSS 整形係として併用するか、埋め込み CSS の整形は諦めて stylelint のリントだけ効かせる構成になる。

## AI コーディングエージェント

bestcss の各パッケージは、この docs ディレクトリごと npm パッケージに同梱している。エージェントには学習データではなく `node_modules/@bestcss/*/docs/` を読ませることで、**インストールされているバージョンと常に一致した情報**で作業させられる。プロジェクトの CLAUDE.md や AGENTS.md に一文入れておくとよい:

```md
bestcss を扱うときは node_modules/@bestcss/core/docs/ と
node_modules/@bestcss/vite-plugin/docs/ を参照すること。
```

## 関連ページ

- ブラウザ DevTools から css`` の定義元へ飛ぶ sourcemap 設定 → [Vite セットアップ](../../vite-plugin/docs/index.md)
- Vitest でテストを動かす設定 → [Vite セットアップ](../../vite-plugin/docs/index.md)
- `@layer` を使う場合の `layers` 設定 → [css`` の文法](./01-syntax.md)
