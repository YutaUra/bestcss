# ADR-0010: ライセンスを MIT に確定する

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

charter はライセンスを「MIT を予定（公開時に確定）」としていた。npm 公開の準備に伴い確定が必要になった。charter の改訂には ADR が必須（ADR-0001）。

## Decision

**MIT** とする。ルートに LICENSE ファイルを置き、公開する全パッケージ（@bestcss/core / vite-plugin / webpack-loader）の `license` フィールドに設定する。

## Alternatives Considered

- **Apache-2.0**: 特許条項がある分手厚いが、CSS ツーリングのエコシステム（Vite / Lightning CSS / 比較対象の CSS ライブラリ群）は MIT が支配的で、採用障壁の低さと簡素さを優先した

## Consequences

### Positive

- 依存追加・fork・商用利用の障壁が最小になり、OSS としての採用が容易

### Negative

- 特許に関する明示的な保護はない

## References

- [LICENSE](../../LICENSE)
- [docs/charter.md](../charter.md)
