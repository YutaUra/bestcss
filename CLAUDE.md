# best-css

ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化を「全部取り」する CSS ライブラリ。

## このプロジェクトについて

詳細は [docs/charter.md](docs/charter.md) を参照。AI が作業時に最低限知っておくべき要点のみここに書く。

- **目的**: 既存 CSS ライブラリ（tailwindcss / panda-css / vanilla-extract / CSS Modules 等）のトレードオフを同時に解消する代替ライブラリを作る
- **やらないこと**: UI コンポーネント集・ランタイム動的スタイル・独自プリプロセッサ構文・コンポーネント生成 API（styled.div`` 風、ADR-0005）。**ゼロランタイムを崩す提案は一切しないこと**
- **想定ユーザー**: まず作者自身。育てば OSS 公開

## ドメイン用語

| 用語 | 意味 |
|------|------|
| ゼロランタイム | 出荷バンドルに CSS 生成コードを一切含めないこと。本プロジェクトの絶対条件 |
| コロケーション | CSS をコンポーネント（JSX）と同じファイルに書くこと |
| 抽出（extraction） | ビルド時に `` css`...` `` の中身を `.css` ファイルへ取り出す変換 |
| core | バンドラー非依存の変換ロジックパッケージ（`packages/core`） |

## AI 協働ルール

- main への直 push で OK（PR は不要）。コミットは小さく、メッセージには Why を書く
- TDD で開発する（グローバルルールの TDD ガイドラインに従う。テスト → 実装の順）
- docs/ の文書は Stability に従って扱う: **charter.md の変更は必ず ADR を切る**（[docs/README.md](docs/README.md) 参照）
- 重要なアーキテクチャ判断をしたら `docs/decisions/` に ADR を追加する（テンプレート: `0000-template.md`）
- 文書を更新したら冒頭の「最終更新」日付も更新する

## 触れてほしくない領域

現時点では特になし。

## 主要な設計判断（要点のみ）

詳細は [docs/architecture.md](docs/architecture.md) と [docs/decisions/](docs/decisions/) を参照。

- CSS パース・変換基盤は Lightning CSS（[ADR-0002](docs/decisions/0002-use-lightning-css.md)）
- pnpm monorepo。変換コア（core）とバンドラー統合（vite-plugin）を分離する
- MVP は「`` css`...` `` が Vite + React で動く」まで。サイズ最適化は Phase 2（[docs/plan.md](docs/plan.md)）
