# ADR-0002: CSS パース・変換基盤に Lightning CSS を採用

- **Status**: Accepted
- **Date**: 2026-07-04
- **Deciders**: yutaura

## Context

bestcss は `` css`...` `` 内の生 CSS をビルド時にパースし、クラス名のスコープ化・ファイル分割・（Phase 2 以降）重複宣言のマージを行う。この変換パイプラインの土台となる CSS パーサー / トランスフォーマーの選定は、性能・拡張性・保守コストのすべてに影響する、プロジェクト最大級のアーキテクチャ判断である。

## Decision

**Lightning CSS** を CSS のパース・変換・minify 基盤として採用する。

- Vite が公式にサポートしており、統合の整合性が高い
- Rust 製で高速。ビルド時変換が前提の bestcss では変換速度がそのまま DX に直結する
- ネスト解決・minify・ベンダープレフィックスなど、必要な標準変換を内蔵している

## Alternatives Considered

- **PostCSS**: JS 製でプラグインエコシステムが最大。AST 操作の自由度が高く実験しやすいが、速度で劣る。ビルド時変換が思想の中核である本プロジェクトでは速度を優先した
- **自前パーサー**: 完全な制御が得られ学習にもなるが、CSS 仕様への追従コストが非現実的。Out of Scope の「独自プリプロセッサ構文を追加しない」方針とも整合しないメリットしかない

## Consequences

### Positive

- Vite との統合が素直になり、変換速度の心配が減る
- ネスト等の標準 CSS 仕様への追従を Lightning CSS に委ねられる

### Negative

- カスタム変換の拡張性は PostCSS より低い。visitor API で表現できない変換が必要になった場合、この ADR を見直す（Supersede する）必要がある
- Rust 製バイナリへの依存により、デバッグ時に内部へ踏み込みにくい

### Neutral

- クラス名生成や重複マージなどの独自ロジックは Lightning CSS の外側（core パッケージ）で実装することになり、責務分離は明確になる

## References

- [Lightning CSS](https://lightningcss.dev/)
- [Vite - CSS Pre-processors / lightningcss](https://vitejs.dev/guide/features#lightning-css)
- [docs/architecture.md](../architecture.md)
