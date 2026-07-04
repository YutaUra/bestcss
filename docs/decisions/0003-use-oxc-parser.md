# ADR-0003: css タグ検出に oxc-parser + magic-string を採用

- **Status**: Accepted
- **Date**: 2026-07-04
- **Deciders**: yutaura

## Context

変換コア（M2）は tsx ソースから `` css`...` `` タグ付きテンプレートを検出し、クラス名リテラルへ書き換える必要がある。検出の信頼性（誤検出ゼロ）と変換速度（全ソースファイルが対象になり得る）の両方が求められる。

## Decision

- 検出: **oxc-parser** で AST を構築し、`@bestcss/core` から import された `css` のタグ付きテンプレートのみを対象とする
- 書き換え: **magic-string** で span（バイト位置）ベースの部分置換を行う

補足として、変換コアは oxc の AST 型に直接依存せず最小限の構造型で扱う。パーサー差し替え時の影響範囲を閉じ込めるため。

## Alternatives Considered

- **@babel/parser + traverse**: 最も枯れた選択肢だが JS 製で遅い。Lightning CSS（ADR-0002）を速度重視で選んだ方針と不整合
- **正規表現**: 依存ゼロで最速だが、コメント内・文字列内の `` css`...` `` を誤検出する。ビルドツールとして信頼性の欠陥になる
- **AST からのコード再生成（printer 使用）**: 書き換え箇所以外のフォーマットが変わってしまい、ソースマップも劣化する。magic-string の部分置換なら元コードをほぼ保持できる

## Consequences

### Positive

- Rust 製で高速。Vite 8（rolldown）と同じ oxc 基盤であり、エコシステムの将来性と整合する
- import 追跡により、他ライブラリの `css` 関数（誤検出）を構造的に排除できる

### Negative

- oxc-parser は napi バイナリ依存であり、対応プラットフォームに制約が出る（Lightning CSS と同種の制約なので実質増加なし）
- oxc の AST 仕様変更に追従が必要（構造型で影響範囲は限定済み）

### Neutral

- scope 解析はしていないため、ローカル変数で `css` を shadowing した場合は誤変換し得る。実用上まれなので MVP では許容する

## References

- [oxc-parser](https://oxc.rs/)
- [magic-string](https://github.com/rich-harris/magic-string)
- [packages/core/src/transform.ts](../../packages/core/src/transform.ts)
