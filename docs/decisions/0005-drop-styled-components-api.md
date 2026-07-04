# ADR-0005: styled-components 風のコンポーネント生成 API を採用しない

- **Status**: Accepted
- **Date**: 2026-07-04
- **Deciders**: yutaura

## Context

charter の当初スコープには「styled-components 風の API（`` styled.div`...` ``）」が含まれており、plan の Phase 3 として予定されていた。MVP（css タグ）と Phase 2（サイズ最適化）が完了した時点で、この API の要否を再検討した。

kickoff 時の思想の核は「**生 CSS に近い文法**で書けること（CSS 資産の活用）」と「**コロケーション**」であり、これらは `` css`...` `` が既に満たしている。styled API が追加で提供するのは「スタイル付きコンポーネントの生成」という別の責務である。

## Decision

styled-components 風のコンポーネント生成 API は **採用しない**。charter の In Scope から削除し、Out of Scope に移す。

bestcss の責務は「css`` をクラス名に変換する」ことに限定する。コンポーネント抽象（クラス名をどの要素にどう当てるか）はユーザーランド（React 等のコンポーネント定義）に任せる。

## Alternatives Considered

- **ゼロランタイムで styled を実装する**: `` styled.button`...` `` をビルド時に `(props) => <button className="..." {...props}/>` 相当へ変換すれば技術的には可能。しかし変換対象がスタイルからコンポーネント定義（props のマージ、ref 転送、as prop など）へ広がり、フレームワーク依存が生まれる。html / vue など JSX 以外への将来展開（charter の拡張余地）とも相性が悪い
- **薄いランタイムヘルパーとして提供する**: 「当たり前にゼロランタイム」という charter の第一原則に反する

## Consequences

### Positive

- ライブラリの責務が「CSS → クラス名」に閉じ、コアが小さく保たれる
- フレームワーク非依存性が維持され、Phase 4（Vite 以外・JSX 以外への展開）の障害が減る

### Negative

- styled-components からの移行者には書き換えコストが生じる（`styled.div` → コンポーネント + `css` タグ）

### Neutral

- Phase 3 は「styled 構文」から「dogfooding（作者の実プロジェクト導入）」に差し替わり、MVP 完了済みのため前倒しできる

## References

- [docs/charter.md](../charter.md)（本 ADR による改訂）
- [ADR-0001](0001-record-architecture-decisions.md)（charter 改訂には ADR 必須）
