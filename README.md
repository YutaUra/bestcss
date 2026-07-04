# bestcss

ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化を「全部取り」する CSS ライブラリ。

## なぜこれが必要か

既存の CSS ライブラリはそれぞれ何かを犠牲にしている。tailwindcss はゼロランタイムと引き換えに HTML の class を肥大させ、styled-components はコロケーションと引き換えにランタイムコストを払い、vanilla-extract / panda-css はゼロランタイムと引き換えに生 CSS 文法を捨て、CSS Modules はファイル分割と引き換えにファイル往復を強いる。

bestcss は、JSX 内に書いた生 CSS をビルド時に抽出・変換することで、これらのトレードオフを同時に解消することを目指す。詳細な思想は [docs/charter.md](docs/charter.md) を参照。

## 書き味

```tsx
// Button.tsx — CSS はコンポーネントの隣に、生 CSS 文法で書く
const button = css`
  padding: 8px 16px;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

export const Button = () => <button className={button}>Click</button>;
```

ビルドすると CSS はファイルとして分割出力され、ランタイムには何も残らない。

### Reset CSS（opt-in）

必要な場合のみ、エントリファイルで import する（中身は [modern-normalize](https://github.com/sindresorhus/modern-normalize) への委譲）:

```ts
import "@bestcss/core/reset.css";
```

自動注入にしていないのは、reset がコンポーネントスタイルより前に読み込まれる必要があり、import 順 = カスケード順をユーザーが制御できるべきだからである。別のリセットを使いたい場合は、これを import せず好きなものを直接 import すればよい。

## 使い方ドキュメント

使い方の正典は **各パッケージに同梱されたドキュメント** で、インストールしたバージョンと常に一致する:

- [@bestcss/core/docs](packages/core/docs/index.md) — css`` の文法・内部のしくみ・reset
- [@bestcss/vite-plugin/docs](packages/vite-plugin/docs/index.md) — セットアップ・オプション・SSR / MPA 統合・Vitest
- [@bestcss/webpack-loader/docs](packages/webpack-loader/docs/index.md) — webpack / Next.js（Turbopack）

## AI エージェントと使う

Next.js と同じパターンで、バージョン一致のドキュメントを node_modules 内に同梱している。プロジェクトルートの `AGENTS.md` に以下を追加すると、エージェントが学習データではなく同梱ドキュメントを参照する:

```md
<!-- BEGIN:bestcss-agent-rules -->

# bestcss: コードを書く前に必ず同梱ドキュメントを読むこと

bestcss に関する作業の前に、`node_modules/@bestcss/core/docs/`（文法・しくみ）と、
使用しているバンドラー統合のドキュメント（`node_modules/@bestcss/vite-plugin/docs/`
または `node_modules/@bestcss/webpack-loader/docs/`）の該当ページを読むこと。
学習データは古い — 同梱ドキュメントが正である。

<!-- END:bestcss-agent-rules -->
```

`BEGIN` / `END` マーカーの外側には自由にプロジェクト固有の指示を書いてよい。Claude Code の場合は `CLAUDE.md` に `@AGENTS.md` と書けば同じ指示が読み込まれる。

> **Status**: Phase 1（MVP）完了。Vite + React で css タグの抽出・HMR まで動作する。npm 未公開のため、試すには本リポジトリの examples を使う。進捗は [docs/plan.md](docs/plan.md) を参照。

## 試す

```sh
pnpm install
pnpm build                                 # packages/core と packages/vite-plugin をビルド
pnpm --filter example-vite-react dev       # SPA サンプル（React）を起動
pnpm --filter example-honox-mpa dev        # MPA サンプル（HonoX, SSR + islands）を起動
pnpm --filter example-vite-storybook storybook  # Storybook サンプルを起動
pnpm --filter example-nextjs dev           # Next.js（Turbopack）サンプルを起動
```

Storybook（react-vite フレームワーク）はプロジェクトの `vite.config.ts` を読み込むため、**Storybook 側の追加設定なしで** css`` がストーリーに効く（[examples/vite-storybook](examples/vite-storybook)）。

## 特徴（目標）

- **ゼロランタイム** — 実行時に CSS を生成するコードを一切出荷しない
- **HTML / CSS 両方のサイズ最適化** — class name の肥大と CSS の重複を両方防ぐ
- **コロケーション** — JSX の中に CSS を置き、スコープを明確にする
- **自然なファイル分割** — 巨大な単一 CSS ではなく、モジュール単位で分割・読み込み
- **生 CSS 文法** — タグ付きテンプレートに生の CSS をそのまま書ける。既存の CSS 資産を活用できる
- **Vite ファースト** — Vite プラグインとして簡単に統合（将来的に Next.js 等へも展開）

## 既存ライブラリとの機能比較

> 最終更新: 2026-07-04。各ライブラリの進化で古くなり得るスナップショットである。
>
> 凡例: ✅ 対応 / 🟡 部分的・工夫すれば可能 / ❌ 未対応（bestcss 列では解消候補の不足） / ➖ 意図的に対象外（[charter](docs/charter.md) 参照）

| 観点 | bestcss | Linaria | styled-components | vanilla-extract | panda-css | tailwindcss | UnoCSS | CSS Modules |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| ゼロランタイム | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| コロケーション | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| 生 CSS 文法 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ネスト / 条件付き at-rules | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ |
| HTML サイズ最適化（class 属性） | ✅ ¹ | 🟡 | 🟡 | 🟡 ² | ❌ | ❌ | 🟡 ³ | 🟡 |
| CSS サイズ最適化（重複排除） | ✅ | ❌ | 🟡 | 🟡 | ✅ | ✅ | ✅ | ❌ |
| スコープ付き @keyframes | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ✅ |
| グローバルスタイル用 API | 🟡 ⁴ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| 実行時の動的スタイル | ➖ ⁵ | 🟡 | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ |
| 型安全なスタイル定義 | ➖ ⁶ | ❌ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | ❌ |
| テーマ / デザイントークン機構 | ➖ ⁵ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Vite 統合 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vite 以外（webpack / Next.js 等） | ✅ ⁸ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| エディタ支援（ハイライト・補完） | 🟡 ⁷ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |

¹ 1 要素 1〜2 クラス + ビルド時の頻度順短縮（[ADR-0004](docs/decisions/0004-build-time-class-name-minification.md)）。実測は [bench/RESULTS.md](bench/RESULTS.md)
² `identifiers: "short"` で短縮可能（頻度順ではない）
³ `compileClass` モードで class 列挙を 1 クラスに合成可能
⁴ 通常の `.css` ファイルで代替する方針（[書き方ガイド](#書き方ガイド)）。専用 API は持たない
⁵ ランタイム動的スタイルとトークン機構は charter で対象外。CSS カスタムプロパティで代替する
⁶ 生 CSS 文法を優先する設計上のトレードオフ。`${}` 補間は型レベルで拒否する
⁷ `css` タグ対応の既存エディタ拡張（vscode-styled-components 等）が流用できる見込み。未検証
⁸ webpack / Next.js（Turbopack）は `@bestcss/webpack-loader` で抽出・ゼロランタイムが動作（[ADR-0008](docs/decisions/0008-non-vite-integration-strategy.md)、[examples/nextjs](examples/nextjs)）。サイズ最適化（短縮・重複排除）は webpack では `BestCssWebpackPlugin` で対応、Turbopack はアセット後処理フックが無いため未対応（内容ハッシュ名のまま）。SSR スイート（ルート分割等）は Vite 版のみ

### この表から見える不足（解消候補）

1. ~~スコープ付き @keyframes~~ — 2026-07-04 解消（css`` 内に書けるようになった）
2. **Vite 以外のビルド環境対応** — Phase 4 として計画済み（[docs/plan.md](docs/plan.md)）
3. **エディタ支援の検証** — 既存拡張で css`` のハイライト・補完が効くかの確認と案内
4. ~~ソースマップ~~ — 2026-07-04 解消（JS: 変換後コード → 元 tsx。CSS: `css.devSourcemap` 有効時に DevTools から css`` の位置へ辿れる）

## ドキュメント

- [docs/charter.md](docs/charter.md) — このプロジェクトの存在意義・スコープ・撤退条件 🪨
- [docs/plan.md](docs/plan.md) — フェーズ・マイルストーン 🌀
- [docs/architecture.md](docs/architecture.md) — 技術スタック・設計判断 🌊
- [docs/decisions/](docs/decisions/) — Architecture Decision Records

## 貢献

現在は作者（[@YutaUra](https://github.com/YutaUra)）による個人開発フェーズ。思想が実証できた段階で OSS として公開し、貢献を受け入れる体制を整える予定。

## ライセンス

TBD（OSS 公開時に MIT を予定）
