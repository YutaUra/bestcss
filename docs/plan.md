> **Stability**: 🌀 evolving
> **最終更新**: 2026-07-04（Phase 2 完了・Phase 3 を dogfooding に差し替え）
> **直近の変更 ADR**: なし（初版）

# Plan — best-css

このプロジェクトの段階的な計画。フェーズの進行や見直しに応じて更新される。

## 現在のフェーズ

**Phase 3: dogfooding**（Phase 1 / MVP、Phase 2 / サイズ最適化は 2026-07-04 完了）

styled 構文は ADR-0005 でスコープ外となり、Phase 3 は dogfooding（作者の実プロジェクト導入）に差し替え。MVP + サイズ最適化が揃ったため前倒しで着手可能。

## MVP 定義

tsx 内の `` css`...` `` タグ付きテンプレートをビルド時に抽出し、CSS ファイルとして分割出力し、生成したクラス名をコードに注入できる。対象は Vite + React のみ。サイズ最適化と styled 構文は MVP に含めない。

完了条件（2026-07-04 すべて達成）:

- [x] `` css`...` `` で書いたスタイルがビルド時に `.css` ファイルとして抽出される
- [x] 抽出された CSS はモジュール単位で分割され、使用箇所からのみ読み込まれる
- [x] 生成されたクラス名が衝突しない（内容ハッシュのため同一クラス名 = 同一スタイル）
- [x] ランタイムに CSS 生成コードが一切含まれない（examples のバンドル解析で確認）
- [x] examples の Vite + React アプリが dev / build の両方で動く
- [x] dev サーバーで HMR が機能する（編集反映・スタイル全削除の統合テストで担保）

## フェーズ計画

### Phase 1: MVP（css タグの抽出と分割出力）

**目標**: Vite + React で `` css`...` `` によるスタイリングが end-to-end で動く

**完了条件 (Definition of Done)**: 上記「MVP 定義」の完了条件をすべて満たす

**想定タイムライン**: TBD（次回更新時に決定）

### Phase 2: サイズ最適化

**目標**: 思想の核心である「HTML / CSS 両方のサイズ最適化」を技術検証・実装する。差別化要因なので styled 構文より先に取り組む

**完了条件**:
- [x] 同一内容の css`` ブロックがモジュールを跨いで 1 ルールに重複排除される（cssMinify 設定に依存しない）
- [x] ビルド時のクラス名短縮（頻度順リネーム、[ADR-0004](decisions/0004-build-time-class-name-minification.md)）: class 属性 -48%、合計 gzip -14%
- [ ] 宣言単位の共有: 異なるブロック間で重複する宣言（例: display: flex）をセレクタリストに括り出す設計判断と実装（ADR-0004 の検討で費用対効果が小さいと判明。優先度を下げ、実プロジェクト規模のデータが揃ってから再判断）
- [x] tailwind 方式（アトミック class 列挙）と比較して HTML サイズが小さいことをベンチマークで示す（class 属性 3,589 bytes vs tailwind 8,985 bytes）
- [x] 既存手法との HTML + CSS 合計サイズ比較レポートがある（[bench/RESULTS.md](../bench/RESULTS.md)）

**技術検証メモ（2026-07-04）**: Vite 8 の cssMinify（Lightning CSS）は「同一セレクタの重複ルール」と「隣接する同一宣言集合のセレクタリスト化」まではやる。**部分的な宣言重複の括り出し（`.a{display:flex;gap:4px}` と `.b{display:flex;gap:8px}` から `display:flex` を共有）はやらない** — ここが best-css 独自の最適化の主戦場になる。ただし括り出しはクラス併用時のカスケード順序に影響し得るため、設計判断（ADR 候補）が必要。

**ベンチマーク結果（2026-07-04、[bench/RESULTS.md](../bench/RESULTS.md)）**: 同一ダッシュボード UI の合計 gzip で best-css 1,494 / CSS Modules 1,908 / tailwind 2,917 bytes（クラス名短縮込み。tailwind 比 51%）。宣言単位共有の伸びしろは raw 27% が理論上限だが gzip 実効はさらに小さく、クラス名短縮（ADR-0004）を優先実装した。

### Phase 3: dogfooding

**目標**: 作者の実プロジェクトに導入し、実利用のフィードバックから改善課題を収集する（styled 構文は [ADR-0005](decisions/0005-drop-styled-components-api.md) によりスコープ外）

**完了条件**:
- [ ] 作者の実プロジェクトへの導入が開始されている
- [ ] 実利用で見つかった課題が Issue / plan に記録されている
- [ ] charter の成功条件「既存ライブラリに戻りたくならない」を実感レベルで検証できている

### Phase 4: Vite 以外への展開

**目標**: unplugin 化などにより Next.js 等の Vite を用いないプロジェクトへ統合できるようにする

詳細は Phase 2〜3 の結果を見て具体化する（TBD）。

## マイルストーン

| マイルストーン | 内容 | 状態 |
|----------------|------|------|
| M1 | monorepo scaffolding（pnpm workspace / core / vite-plugin / examples） | ✅ 完了 |
| M2 | css タグ抽出の変換コア（Lightning CSS ベース） | ✅ 完了 |
| M3 | Vite プラグイン統合（build） | ✅ 完了 |
| M4 | dev サーバー / HMR 対応 → **MVP 完了** | ✅ 完了 |
| M5 | サイズ最適化の技術検証（Phase 2） | ✅ 完了（宣言単位共有のみ保留として切り出し） |
| M6 | 実プロジェクトへの導入開始（Phase 3） | ⬜ 未着手 |

## 計画の見直しトリガー

以下が起きたら計画全体を見直す:

- Phase 2 の技術検証で「サイズ最適化が既存手法に勝てない」結果が出た（→ charter の撤退条件に直結）
- Lightning CSS の制約により生 CSS 文法の扱いに重大な支障が出た（→ [ADR-0002](decisions/0002-use-lightning-css.md) の見直し）
- 想定ユーザーが変わった（OSS 公開を前倒しする場合など）
