# ADR-0011: ルート CSS はチャンクグラフから導出せず、プラグインが自前 emit する

- **Status**: Accepted（ADR-0007 の実装方式を置き換える）
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

issue #2（dogfooding で検出）: Vite 6 環境で、複数ルートが共有するコンポーネントの CSS が 1 ルートの manifest にだけ帰属し、他ルートが本番で無スタイルになった。

ADR-0007 の実装は「ルートごとの空 JS スタイルエントリを注入し、分割判断を Vite のチャンク分割に委ね、manifest をチャンクグラフ（viteMetadata / imports の走査）から導出する」ものだった。しかし空 JS のスタイルエントリは Vite の pure-CSS チャンク処理の対象で、**統合・除去のされ方がバージョン依存**（Vite 6 / Rollup と Vite 8 / rolldown で異なる）であり、チャンクグラフから「どのルートがこの CSS を必要とするか」を復元できなくなる。回帰テストで Vite 6 の再現を確認した。

## Decision

manifest とルート CSS アセットの情報源を、チャンクグラフから**プラグイン自身の知識**（ルート → styled モジュールの対応。import グラフの走査で得る）に変える。

1. buildStart でルートごとの styled ファイル一覧を収集する（スタイルエントリの注入は廃止）
2. generateBundle で、**同じルート集合から参照されるモジュールを 1 アセットにグループ化**（共有シグネチャ）し、dedupe + minify + クラス名短縮を適用して**プラグインが自前 emit** する
3. manifest はグループとルートの対応から直接生成する

共有シグネチャによるグループ化は、issue #2 で提案された (a) 共有バケットと (b) fan-out の両立になる: 全ルート共有のスタイルは 1 ファイル（キャッシュ効率）で全ルートの manifest に載り、ルート専用はそのルートにのみ載る。

## Alternatives Considered

- **チャンクグラフ導出の修正（fan-out の追跡強化）**: pure-CSS チャンクの統合・除去は Vite バージョンごとに挙動が違い、追いかけ続けるのは不毛。情報の発生源（プラグイン自身の走査結果）を使う方が構造的に安定する
- **`_shared` バケット固定（案 a のみ）**: 「一部のルートだけで共有」のケースで全ページに配ってしまう。シグネチャグループ化なら共有粒度が正確になる

## Consequences

### Positive

- Vite 6 / 8 の両方で同一挙動（両バージョンの回帰テストで担保）
- 空 JS チャンクの後始末が不要になり、実装が単純化

### Negative

- 自前 emit のため Vite の CSS パイプライン（ユーザーの postcss プラグイン等）を通らない。minify は core の Lightning CSS で同等を担保
- island 等クライアント JS グラフにも入るスタイルは、ルート CSS と island チャンク CSS に重複し得る（正しさ優先。最適化は将来課題）

### Neutral

- ルート専用モジュールのクラス名は generateBundle 冒頭の事前変換で短縮表へ登録する（クライアント JS グラフに現れないため）

## References

- [issue #2](https://github.com/YutaUra/bestcss/issues/2)
- [ADR-0007](0007-route-styles.md)（目的とグラフ走査による収集は継続。チャンク由来の manifest 導出を本 ADR で置き換え）
