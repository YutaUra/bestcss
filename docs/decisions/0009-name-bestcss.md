# ADR-0009: プロジェクト名を `bestcss`（ハイフンなし）に統一する

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

kickoff 以来、プロジェクト名は `best-css`（ハイフンあり）を用い、npm パッケージも `@best-css/*` スコープ配下で開発していた。publish に向けて npm の organization を作成しようとしたところ、`best-css` は取得できなかった（`The organization name 'best-css' is not available.`）。npm では organization 名・ユーザー名・予約名が単一の名前空間を共有しており、`best-css` は既にその名前空間を占有されていたためである。

代わりに `bestcss`（ハイフンなし）の organization は取得できた。これにより「公開スコープは `@bestcss`、それ以外のブランド表記は `best-css`」という **同一単語がハイフン有無で 2 通りに割れる状態** が生じた。同じ単語のハイフン差は利用者が恒常的にタイポする種類の摩擦であり、共存させる価値は低い。

まだ publish 前であり、`.best-css.css` 等の内部マーカー（ビルド成果物・sourcemap に露出する）を変更しても破壊的変更にならない。統一するなら今が唯一のコストゼロな機会である。

## Decision

プロジェクトの正式名を **`bestcss`（ハイフンなし）に全面統一** する。

- npm スコープ: `@bestcss/*`
- 内部マーカー: 仮想 CSS サフィックス `.bestcss.css`、仮想モジュール `virtual:bestcss/*`、ルート仮想 ID `\0bestcss-route:`、共有ディレクトリ `node_modules/.bestcss`、プラグイン名 `"bestcss"`、自己 import クエリ `?bestcss`
- ドキュメント・README・charter・例のブランド表記
- GitHub リポジトリ名（`gh repo rename bestcss` で追随）

`best-css`（ハイフンあり）の表記はコードベースから排除する。

## Alternatives Considered

- **公開スコープだけ `@bestcss`、ブランドは `best-css` のまま共存**: churn は最小だが、同一単語のハイフン差が publish 後まで恒久的に残り、ドキュメントの `best-css` とパッケージ名 `@bestcss` の不一致が利用者を混乱させる。pre-publish の今しか内部マーカーを無償で変えられないため、将来に負債を先送りするだけと判断
- **別単語の org 名にしてブランドは `best-css` を維持**（例 `@best-css-dev`）: プロジェクトの核となる短い名前を捨てることになり、`best-css` という素の名前が使えない点は `bestcss` と同じ。むしろ冗長
- **npm サポートに `best-css` 名の解放を申請**: 他者が占有する名前空間は基本的に返らず、publish 計画をブロッキングにする不確実性が高い

## Consequences

### Positive

- スコープ・内部マーカー・ドキュメントの表記が 1 つに揃い、タイポ源が消える
- `postcss` / `stylelint` / `browserslist` と同様、CSS ライブラリとしてハイフンなしは自然な命名
- pre-publish のため利用者への影響ゼロで完了

### Negative

- 既存の内部マーカー（`.best-css.css` 等）を参照するテスト・fixture の一括改名が必要（本 ADR と同時に実施済み）
- GitHub リポジトリ名の変更は外部アクションであり、既存のローカル clone / リモート URL の更新を別途要する

### Neutral

- ローカルの作業ディレクトリ名（`.../yutaura/best-css`）はファイル内容に埋め込まれていないため、リポジトリ名変更とは独立に任意のタイミングで追随できる

## References

- [docs/charter.md](../charter.md)（本 ADR により名称を改訂）
- [ADR-0001](0001-record-architecture-decisions.md)（charter 改訂には ADR 必須）
- [ADR-0008](0008-non-vite-integration-strategy.md)（`?bestcss` 自己 import クエリを用いる webpack 統合）
