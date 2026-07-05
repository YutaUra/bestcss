# ADR-0012: カスケードレイヤーは生 CSS 構文（@layer ブロック）で対応し、JS API は追加しない

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: yutaura

## Context

issue #5（dogfooding で検出）: `` `${base} ${variant}` `` のようなクラス合成で同一プロパティが衝突すると、勝敗が「スタイルシート内のルール出力順」で決まり、className の並び順とは無関係なため直感に反する。ADR-0004 の頻度順短縮やファイル分割によって出力順は安定保証できず、合成の勝敗を利用者がコントロールできる仕組みが必要になった。

issue では 2 案が提案された: (A) CSS カスケードレイヤーへの割り当て、(B) variants/recipe API。検討の結果 **B は見送り、A のみ実装**とした（後述）。

A の API 形状には `css.layer("name")\`...\`` のようなタグ関数派生案もあったが、既存 CSS エコシステム資産（Prettier の埋め込み CSS フォーマット、stylelint、エディタ拡張）が使えるかを実測したところ:

- `css\`...\`` タグ内の `@layer name { ... }` → Prettier がフォーマットし、stylelint がリントする（**すべて動く**）
- `css.layer("name")\`...\`` → タグ名が `css` でなくなるため埋め込み CSS として認識されず、**フォーマットもリントも外れる**

また実装中に Lightning CSS の挙動として、順序宣言文 `@layer a, b, c;` が後続ブロックの使用状況に応じて**切り詰められる**ことを発見した（例: components ブロックのみ使用時、`@layer base, components, utilities;` が `@layer base;` に縮められ、utilities が消える）。ファイル単位の変換ではファイル間の順序が壊れうる。

## Decision

1. **構文は生 CSS**: css`` ブロック直下に `@layer name { ... }` を書く。JS API（`css.layer()` 等）は追加しない。既存ツールチェーンの互換を守ることが「生 CSS 文法」という本プロジェクトの価値そのものだから
2. **レイヤー順はプラグイン設定 `layers: string[]` が所有する**（下位 → 上位）。宣言にない名前の使用は**ビルドエラー**。CSS ネイティブの「初出順」に委ねると、ファイル処理順という非決定要素に勝敗が依存してしまうため
3. **順序宣言文は Lightning CSS の後段で付与する**。core は変換後に完全な `@layer a, b, c;` を先頭付与（sourcemap は 1 行シフト）、`dedupeCss` は順序宣言文のみ keep-first（通常ルールは keep-last）、Vite プラグイン / webpack プラグインは最終アセットにも権威ある宣言を再付与する。Vite 自身の cssMinify も切り詰めを行うため、最終アセット段の防衛が必須
4. **recipe / variants API（案 B）は見送り**。ゼロランタイムを保ったまま実装するには css`` の戻り値（文字列）の組み合わせで十分表現でき、cva 等の既存ライブラリと `css\`\`` の文字列をそのまま組み合わせられる。専用 API はスコープ膨張に対して利得が薄い

## Alternatives Considered

- **`css.layer("name")\`...\`" タグ API**: 型で層名を縛れる利点はあるが、Prettier / stylelint / エディタの埋め込み CSS 認識がすべて外れることを実測で確認。ツール互換 > 型安全と判断
- **レイヤー順を「初出順」に委ねる（設定不要）**: 設定ゼロで書き始められるが、ビルドのファイル処理順で勝敗が変わる非決定性を持ち込む。本プロジェクトは決定的な出力を優先する
- **順序宣言文を Lightning CSS の前段に置く**: Lightning CSS が使用状況に応じて宣言を切り詰めるため、未使用レイヤー名が消えてファイル間順序が壊れる。後段付与 + 多段防衛（dedupe keep-first + アセット再付与）を採用
- **recipe API（cva 風 variants + compoundVariants）**: ランタイムに分岐コードを持ち込まず実装は可能だが、css`` 文字列 + 既存の cva で同等の体験が得られる。必要になったら再検討（issue #5 に記録）

## Consequences

### Positive

- 合成の勝敗が出力順から独立し、レイヤー順で決定的になる（issue #5 の根本解決）
- Prettier / stylelint / エディタ拡張がそのまま機能し続ける
- 未宣言レイヤー名がビルドエラーになるため、タイポや順序未定義が本番に漏れない

### Negative

- `@layer` を使うには `layers` 設定が必須（設定ゼロでは使えない）。エラーメッセージで設定方法を案内して緩和
- webpack / Turbopack では loader・css loader・プラグインの複数箇所に同じ `layers` を渡す必要がある（構成の重複）
- レイヤー構文を含むブロックは構文込みでハッシュされるため、同一宣言でもレイヤーが違えば別クラスになる（意図どおりだが、重複排除は効かない）

## References

- Issue: <https://github.com/YutaUra/bestcss/issues/5>
- 関連: ADR-0004（出力順が安定しない一因）、ADR-0005（API 追加へ抑制的な前例）
