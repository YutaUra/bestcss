# CSS 変数とデザイントークン

bestcss は CSS 変数（カスタムプロパティ）に対して**特別なサポートを何もしない**。css`` の中の `var(--x)` は生 CSS としてそのまま抽出される。これは手抜きではなく設計で、変数の解決をビルド時に肩代わりしない（= プラットフォームのカスケードに委ねる）からこそ、テーマ切り替えや継承といった CSS 変数本来の動きがそのまま使える。

その代わり、bestcss の設計において CSS 変数は 2 つの役割を一手に引き受ける:

1. **動的な値の唯一の経路** — `${}` 補間は禁止なので、実行時に変わる値は CSS 変数 + style 属性で渡す（[css`` の文法](./01-syntax.md) を参照）
2. **デザイントークンの置き場** — 色・余白・タイポグラフィの一元管理

## デザイントークンは CSS 変数で持つ

`:root` はクラスにスコープできないため css`` には書けない。トークン定義は通常の CSS ファイルに置き、エントリで import する:

```css
/* tokens.css */
:root {
  --color-primary: #2563eb;
  --color-text: #111;
  --space-md: 16px;
}
```

```ts
// main.tsx（エントリ）
import "./tokens.css";
```

コンポーネント側は css`` から `var()` で参照するだけ:

```ts
const card = css`
  color: var(--color-text);
  padding: var(--space-md);
`;
```

トークンをビルド時定数（TS の定数を補間）ではなく CSS 変数にする利点は、**値の切り替えが CSS だけで完結する**こと。ダークテーマは変数の上書きで済み、コンポーネント側の css`` は一切変わらない:

```css
/* tokens.css に追記 */
[data-theme="dark"] {
  --color-text: #eee;
}
```

## typo に気づく仕組み

`var(--colr-primary)` のような typo は、CSS の仕様上エラーにならない（未定義の変数は unset に落ちるだけ）。ビルドも通ってしまうため、エコシステム側で検出する。

### stylelint — 未定義の変数参照を検出する

[stylelint-value-no-unknown-custom-properties](https://github.com/csstools/stylelint-value-no-unknown-custom-properties) に、トークン定義ファイルを `importFrom` で教える（css`` 内をリントする前提設定は [エディタとツールチェーンの活用](./04-tooling.md) を参照）:

```sh
pnpm add -D stylelint-value-no-unknown-custom-properties
```

```json
// .stylelintrc.json（04-tooling の設定に plugins と rules を追加）
{
  "extends": ["stylelint-config-standard"],
  "customSyntax": "postcss-styled-syntax",
  "plugins": ["stylelint-value-no-unknown-custom-properties"],
  "rules": {
    "csstools/value-no-unknown-custom-properties": [
      true,
      { "importFrom": ["src/tokens.css"] }
    ]
  }
}
```

tokens.css にない変数を css`` 内で参照すると検出される（実測）:

```
vars.tsx
  9:14  ✖  Unexpected custom property "--colr-primary" inside declaration "color".
           csstools/value-no-unknown-custom-properties
```

**注意**: `var(--foo, 8px)` のようにフォールバック付きの参照は「未定義でも意図どおり」とみなされ、検出対象外になる。トークン参照にはフォールバックを書かない（typo 検出を効かせる）、外部から注入される動的変数にはフォールバックを書く（style 属性で渡し忘れても壊れない）、と使い分けるとちょうど噛み合う。

なお `stylelint-config-standard` に入っている `custom-property-pattern` が命名規則（既定は kebab-case）も強制するため、`--colorPrimary` と `--color-primary` の混在も防げる。

### エディタ — 補完と定義ジャンプ

VS Code 拡張の [CSS Variables](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables) は、プロジェクト内の `**/*.css`（tokens.css を含む）から変数定義を収集し、`typescript` / `typescriptreact` を対応言語に含むため **css`` の中でも補完・カラープレビュー・定義ジャンプ（Cmd+クリックで tokens.css へ）が効く**。トークン名を覚えていなくても `var(--` まで打てば一覧が出るので、そもそも typo が生まれにくい。

## 動的な値との組み合わせ

実行時に変わる値は、トークンと同じ `var()` 構文のまま style 属性から注入する:

```tsx
const bar = css`
  width: var(--progress, 0%);
  background: var(--color-primary);
`;

<div
  className={bar}
  style={{ "--progress": `${percent}%` } as React.CSSProperties}
/>;
```

静的なトークン（`--color-primary`）と動的な値（`--progress`）が同じ仕組みに乗るため、「どこまでがビルド時でどこからが実行時か」を css`` の中で意識する必要がない。動的側にだけフォールバックを書いておくと、注入漏れでもレイアウトが壊れない。

## 関連ページ

- `${}` 補間が禁止される理由とグローバル定義の扱い → [css`` の文法](./01-syntax.md)
- stylelint / エディタの前提セットアップ → [エディタとツールチェーンの活用](./04-tooling.md)
