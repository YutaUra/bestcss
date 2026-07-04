# ADR-0006: SSR でのクラス名短縮はリネーム表の共有で行う

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

クラス名短縮（ADR-0004）のリネーム表は「そのビルドに含まれるクラスの集合と頻度」の関数である。SSR 構成では HTML（サーバービルド）と CSS（クライアントビルド）が独立したビルドから出るため、それぞれが独自に短縮すると名前が一致せずスタイルが失われる。このため SSR では `minifyClassNames: false`（内容ハッシュ名）を強いており、ベンチで実証した削減（class 属性 -48%）を放棄していた。

Vite の manifest が「ハッシュ付きファイル名の間接参照」を調停するのと同様に、「ファイル内容の識別子（クラス名）」の層にも調停役が必要である。

## Decision

プラグインに `renameMapPath` オプションを追加し、**クライアントビルドが確定したリネーム表を JSON で書き出し、サーバービルドが同じ表を読んで書き換える**（クラス名版 manifest）。ビルド順はクライアント → サーバーを前提とする。

実装上の要点:

- **サーバー側の適用は generateBundle ではなく transform 時に行う**。@hono/vite-ssg のようにバンドルを作らずモジュールランナーでサーバーコードを実行して HTML を書き出すツールでは、generateBundle が HTML 生成経路を通らないため
- 適用のゲートは `command === "build"` ではなく **`isProduction`**。SSG はビルド中に内部ランナー（command=serve の設定）で configResolved を再度呼ぶため、command は信頼できない
- **表の書き出しは CSS アセットを持つ環境に限定**。SSG 等が走らせる空のクライアント環境による上書きを防ぐ
- 表なしのサーバービルドは短縮しない（独自頻度での短縮は常に不整合のため）。これは renameMapPath 未使用時の安全化でもある

## Alternatives Considered

- **SSR では短縮しない（従来）**: 安全だが class 属性 -48% の削減を放棄する。`renameMapPath` を設定しない場合のフォールバックとして残る
- **dist 全体への後処理 CLI**: SSG なら最終 HTML の実頻度で数えられる利点があるが、ランタイム SSR に使えない。将来の追加最適化としては両立可能
- **内容ハッシュの切り詰め**: ビルド間で決定的だが、短くすると衝突（別スタイルの誤適用）のリスクが戻る

## Consequences

### Positive

- SSR / SSG 構成でもクラス名短縮が有効化できる（HonoX example で HTML / CSS の完全一致を検証済み)
- サーバービルドの自己短縮という「静かに壊れる」既定挙動が消えた

### Negative

- クライアント → サーバーのビルド順序が契約になる（順序違反は明示的なエラーで検出）
- 表ファイルという中間生成物が増える（dist 配下に置けば管理は不要）

### Neutral

- dev は従来どおり bc 名（表は本番変換でのみ使う）

## References

- [ADR-0004](0004-build-time-class-name-minification.md)
- [examples/honox-mpa/vite.config.ts](../../examples/honox-mpa/vite.config.ts)
