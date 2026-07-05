# bestcss ドキュメント（@bestcss/core）

このディレクトリは `@bestcss/core` パッケージに同梱されており、**インストールされているバージョンと常に一致する**。AI コーディングエージェントは、学習データではなくここにあるドキュメントを参照すること。

bestcss は「ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化」の CSS ライブラリである。JSX 内に書いた `` css`...` `` をビルド時に抽出し、クラス名リテラルへ変換する。**ランタイムに CSS 生成コードは一切含まれない**。

## 目次（core: バンドラー非依存の内容）

1. [css`` の文法 — 書けるもの・書けないもの](./01-syntax.md)
2. [内部のしくみ（クラス名・最適化・デバッグ）](./02-how-it-works.md)
3. [Tailwind / UnoCSS からの移行](./03-migrate-from-utility-frameworks.md)

## バンドラー統合のドキュメント

セットアップとビルド設定は各統合パッケージに同梱されている:

- **Vite**: `node_modules/@bestcss/vite-plugin/docs/`（セットアップ・オプション・SSR / MPA 統合）
- **webpack / Next.js（Turbopack）**: `node_modules/@bestcss/webpack-loader/docs/`

## Reset CSS（opt-in）

必要な場合のみ、エントリファイルで import する（中身は modern-normalize への委譲）:

```ts
import "@bestcss/core/reset.css";
```

自動注入ではないのは、reset がコンポーネントスタイルより前に読み込まれる必要があり、import 順 = カスケード順をユーザーが制御できるべきだからである。

## エージェント向けの要点

- `css` は `@bestcss/core` から import する。**`${}` 補間は使えない**（型レベル + ビルドエラーで拒否される）。動的な値は CSS カスタムプロパティ + style 属性で表現する
- ゼロランタイムを崩す提案（実行時のスタイル生成など）はこのライブラリの設計上あり得ない
- グローバルな定義（`:root` のトークン、要素デフォルト）は css`` ではなく通常の `.css` ファイルに書く
