# ADR-0008: Vite 以外への展開は matchResource 方式の loader で行う

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

Phase 4（Vite 以外のビルド環境対応）の技術検証。Vite 統合は「仮想 CSS モジュール」を土台にしているが、Next.js のデフォルトバンドラーである Turbopack の拡張ポイントを調査した結果:

- Turbopack は `turbopack.rules` で **webpack loader を実行できる**（path / query / content 条件、`as` による出力タイプ変更に対応）
- ただし loader API の **`emitFile` は使えず、仮想モジュール機構もない**（`fs` は readFile のみ部分サポート）

つまり Vite の仮想モジュール戦略はそのまま持ち込めない。

## Decision

**「実在するソースファイル自身を、CSS として再読み込みさせる」** 方式を採る。

1. メイン loader が css`` をクラス名リテラルへ変換し（core の `transform` を無改造で再利用）、`<file>.best-css.css!=!@bestcss/webpack-loader/css!<file>` という **matchResource（`!=!`）構文**の import を追記する
2. matchResource が `.css` なので、利用側の既存 CSS ルール（css-loader / mini-css-extract / Next.js 内蔵の CSS 処理）がそのまま適用される
3. `@bestcss/webpack-loader/css` は元ファイルを受け取り、抽出 CSS テキストを返すだけの loader

vanilla-extract の webpack 統合と同じ確立されたパターンであり、ファイルが実在するため仮想モジュール機構が不要。Turbopack へは同じ発想を `rules` の query 条件 + `as: '*.css'` で展開できる見込み（未検証、M8 で確認する）。

`@bestcss/webpack-loader` として実装し、webpack 5 + css-loader + mini-css-extract の実ビルドでゼロランタイム・クラス名一致を検証済み。

## Alternatives Considered

- **unplugin**: バンドラー横断の抽象だが、肝心の「CSS をどう配信するか」はバンドラーごとに異なり抽象の外にある。仮想モジュール前提の unplugin 実装は Turbopack に届かない
- **webpack-virtual-modules**: webpack では動くが rspack / Turbopack に移植できず、依存も増える
- **SWC プラグインで Turbopack ネイティブ対応**: wasm ビルドの保守コストが高く、CSS の側路（抽出結果の受け渡し）が結局未解決

## Consequences

### Positive

- core（変換ロジック）がバンドラー非依存である設計（M1 の分離判断）が実証された
- webpack / rspack / Turbopack（loader 互換）に同一の発想で展開できる

### Negative

- Vite 版が持つ最適化・SSR スイート（クラス名短縮 / 重複排除 / ssr オプション / routeStyles）は loader 版に未実装。webpack では compilation フックでの実装が別途必要
- Turbopack の `as: '*.css'` での CSS パイプライン接続は未検証（M8: Next.js example で確認）

### Neutral

- Vite 統合は従来どおり仮想モジュール方式を継続する（HMR・dev の体験が優れているため）

## References

- [packages/webpack-loader](../../packages/webpack-loader)
- [Next.js Turbopack docs（loader サポートと制限）](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)
