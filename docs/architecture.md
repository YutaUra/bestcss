> **Stability**: 🌊 living
> **最終更新**: 2026-07-04（M2 完了）
> **直近の変更 ADR**: [ADR-0003](decisions/0003-use-oxc-parser.md)

# Architecture — bestcss

このプロジェクトの技術構成と設計判断。実装に追従して自由に更新する。重要な設計判断は `decisions/` に ADR として記録する。

## 全体構成

TypeScript 製の pnpm monorepo。「変換コア」と「バンドラー統合」を分離し、将来の Vite 以外への展開に備える。

```
bestcss/
├── packages/
│   ├── core/          # 変換コア: css タグの抽出・クラス名生成・CSS 出力（バンドラー非依存）
│   └── vite-plugin/   # Vite 統合: core を Vite のモジュールグラフに接続する
├── examples/
│   └── vite-react/    # dogfooding 兼 E2E 検証用のサンプルアプリ
└── docs/
```

データの流れ（ビルド時）:

```
.tsx ソース
  → css タグの検出・抽出（core）
  → 生 CSS のパース・変換・クラス名生成（Lightning CSS）
  → 仮想 CSS モジュールとして Vite に供給（vite-plugin）
  → コード側にはクラス名参照のみが残る（ゼロランタイム）
```

## 技術スタック

| 領域 | 採用技術 | 採用理由 / 関連 ADR |
|------|----------|---------------------|
| 言語 | TypeScript | エコシステム（Vite / unplugin）との親和性 |
| CSS パース・変換 | Lightning CSS | [ADR-0002](decisions/0002-use-lightning-css.md) |
| JS/TS パース | oxc-parser | [ADR-0003](decisions/0003-use-oxc-parser.md) |
| コード書き換え | magic-string | span ベース部分置換で元コードとソースマップを保持 |
| パッケージ管理 | pnpm workspace（monorepo） | core と統合層の分離。将来のパッケージ追加に対応 |
| テスト | Vitest | Vite プロジェクトとの一貫性。TDD で開発する |
| 対象バンドラー | Vite（まず） | charter 参照。Phase 4 で unplugin 化を検討 |

## 主要な設計判断

- [ADR-0001: アーキテクチャ判断記録方式の採用](decisions/0001-record-architecture-decisions.md)
- [ADR-0002: CSS パース・変換基盤に Lightning CSS を採用](decisions/0002-use-lightning-css.md)
- [ADR-0003: css タグ検出に oxc-parser + magic-string を採用](decisions/0003-use-oxc-parser.md)
- core と vite-plugin の分離: 変換ロジックをバンドラー非依存に保ち、Phase 4（Next.js 等への展開）でコアを再利用できるようにする
- クラス名は CSS 内容のみの FNV-1a ハッシュ（`bc` プレフィックス + base36）: 同一内容をファイル横断で同一クラス名に収束させ、Phase 2 の重複排除の基盤にする
- `${}` 補間はビルドエラー: charter の「ランタイム動的スタイルはやらない」を実装レベルで強制する。動的値は CSS カスタムプロパティで表現する。`css` スタブの型（`values: never[]`）でも拒否する

## 外部依存

| 依存先 | 用途 | リスク |
|--------|------|--------|
| Lightning CSS | 生 CSS のパース・変換・minify | カスタム変換の拡張性が PostCSS より低い。visitor API で不足が出たら ADR-0002 を見直す |
| Vite | プラグイン統合先 | プラグイン API の破壊的変更に追従が必要 |

有料 SaaS への依存はなし。

## 非機能要件

- **ゼロランタイム**: 出荷されるバンドルに CSS 生成コードを含めない。これは非機能要件ではなく存在意義（charter 参照）
- **ビルド速度**: 大規模プロジェクトでもビルド時間を体感的に悪化させない（具体的な目標値は TBD、Phase 2 のベンチマークで設定）
- **出力サイズ**: HTML + CSS の合計サイズで既存手法（tailwindcss / CSS Modules）を上回らないこと

## テスト戦略

TDD（Red-Green-Refactor）で開発する。

- **単体テスト**: core の変換ロジック（css タグ抽出、クラス名生成、CSS 出力）を入力→出力のスナップショット中心に検証
- **統合テスト**: vite-plugin を実際の Vite ビルドに通し、出力バンドル・CSS ファイルを検証
- **E2E**: examples アプリのビルド成果物でゼロランタイム性（CSS 生成コードの不在）を検証

## 監視・観測

ライブラリのため本番監視は対象外。CI（GitHub Actions を想定、TBD）でテストとベンチマークを回す。

## デプロイ

- npm への publish を想定（OSS 公開フェーズで整備、TBD）
- 当面はローカル / workspace 参照での dogfooding
