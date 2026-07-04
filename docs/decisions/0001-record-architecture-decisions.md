# ADR-0001: アーキテクチャ判断記録方式の採用

- **Status**: Accepted
- **Date**: 2026-07-04
- **Deciders**: yutaura

## Context

このリポジトリの設計判断を、後から「なぜそう決めたか」追えるように残したい。git log とコミットメッセージだけでは、判断の context や検討した代替案が散逸する。

## Decision

Michael Nygard 形式の Architecture Decision Record (ADR) を `docs/decisions/` ディレクトリに採用する。

- 1 つの ADR は 1 つの決定を記録する
- ファイル名: `NNNN-short-title.md`（NNNN は連番）
- 構造: Context / Decision / Alternatives Considered / Consequences
- 採用後の決定は **immutable**（書き換えず、新しい ADR で Supersede する）

`docs/charter.md` の改訂時は ADR を切ることを必須とする。`docs/architecture.md` の重要な変更時は推奨。

## Alternatives Considered

- **コミットメッセージのみで残す**: context や代替案が散逸しやすい
- **wiki / Notion などの外部ツール**: git で管理されないため、コードと同期しなくなる
- **CHANGELOG.md にまとめる**: 「変更ログ」と「決定の根拠」は性質が異なり、混在させると読みにくい

## Consequences

### Positive

- 重要な判断の根拠が永続化される
- 新規参入者（将来の OSS コントリビューター含む）が過去の判断経緯を理解できる
- charter.md の不変領域が変更されたとき、履歴が残る

### Negative

- ADR を書く手間が発生する
- 「これは ADR にすべきか」の判断疲れが起きうる

### Neutral

- 個人開発では ADR 数が少なく済む可能性がある（無理に増やさない）

## References

- [Michael Nygard, "Documenting Architecture Decisions" (2011)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [adr.github.io](https://adr.github.io/)
