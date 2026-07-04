# ADR-0007: SSR でのルート単位 CSS 分割はスタイルエントリの注入で行う

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

charter の「自然なファイル分割」は、SPA では Vite の CSS コード分割がそのまま実現する（MPA テストで検証済み）。しかし SSR フレームワークではルートがサーバー専用モジュールでクライアントビルドに入らず、スタイルを単一の収集エントリ経由で拾っていたため、全ページ分の CSS が 1 ファイルに集約されていた。アプリが成長して `/admin` のようなルート専用スタイルが増えると、使わない CSS を全ページに配ることになる。

## Decision

プラグインに `routeStyles: { dir }` オプションを追加する。

1. **仮想 CSS モジュールの遅延ロード化**: ソースを JS として import しなくても `<file>.best-css.css` を単独ロード可能にする（fs 読み込み + オンデマンド変換）
2. **ルートごとの仮想スタイルエントリ**: ルートファイルの import グラフを静的に辿り（oxc で import 指定子を抽出、解決は Vite の resolver）、css`` を含むファイルの仮想 CSS を side-effect import するだけのエントリを client ビルドに注入する
3. **分割判断は Vite に委ねる**: 複数エントリから参照される共有 CSS は共有チャンクへ、ルート専用はルートのファイルへ、という判断は Vite のチャンク分割がそのまま行う
4. **ルート → CSS の対応表**（`.best-css/route-css.json`）を出力し、SSR の renderer がルートに応じた `<link>` を注入する（Vite の ssrManifest と同型の発想）

`routeStyles` はクライアント側の設定にのみ指定する（CSS の出力はクライアントビルドの責務）。

## Alternatives Considered

- **cssCodeSplit: false で 1 ファイル集約（従来）**: 小規模ではキャッシュ効率も良く合理的だが、ルート専用スタイルの増加に耐えない。routeStyles 未使用時の構成として引き続き選べる
- **レンダリング時にスタイルを収集**: styled-components 等のランタイム収集はゼロランタイム原則に反する
- **サーバービルドのモジュールグラフから収集**: @hono/vite-ssg はバンドルを作らないため generateBundle 経由のグラフが存在しない。クライアントビルド側で完結させる方が構成に依存しない

## Consequences

### Positive

- ルート専用 CSS はそのルートでのみ読み込まれ、共有 CSS は 1 ファイルでキャッシュされる（HonoX example の /admin で検証済み）
- 手動のスタイル収集 import が本番ビルドから不要になった（dev のみ HMR のために残る）

### Negative

- import グラフの静的走査は動的 import の文字列リテラル以外（変数指定など）を追えない
- ルートキー（ファイルパス由来）とリクエストパスの対応付けは renderer 側ヘルパーの責務で、動的セグメント等の複雑なルーティングは未対応

### Neutral

- スタイルエントリの空 JS チャンクは manifest 記録後に成果物から取り除く

## References

- [ADR-0006](0006-rename-map-sharing.md)（リネーム表の共有。本機能と併用可能）
- [examples/honox-mpa](../../examples/honox-mpa)
