> **Stability**: 🌊 living
> **最終更新**: 2026-07-05
> **直近の変更 ADR**: [ADR-0010](decisions/0010-mit-license.md)

# Releasing — bestcss

npm への公開手順。公開対象は `@bestcss/core` / `@bestcss/vite-plugin` / `@bestcss/webpack-loader` の 3 パッケージ（examples / bench は private）。

**公開は GitHub Actions（[release.yml](../.github/workflows/release.yml)）が行う。** `v*` タグの push がトリガー。npm の Trusted Publishing (OIDC) を使うため、トークンも OTP も不要で、provenance（来歴証明）が自動付与される。

## 事前に一度だけ必要なもの

- npm の organization **`bestcss`**（スコープ `@bestcss/*` の公開に必要）
- **各パッケージへの Trusted Publisher 登録**（npmjs.com で 3 パッケージそれぞれに設定）:
  1. パッケージページ → Settings → Trusted Publisher → **GitHub Actions**
  2. Organization or user: `YutaUra` / Repository: `bestcss` / Workflow filename: `release.yml` / Environment: （空欄）
- GitHub リポジトリ（package.json の repository は `github.com/YutaUra/bestcss` を指している）

## 手順

```sh
# 1. バージョンを 3 パッケージ同時に上げる（当面はロックステップ運用）
#    packages/*/package.json の version を編集する

# 2. ローカル検証（CI でも同じことが走るが、タグを打つ前に手元で確認する）
pnpm install
pnpm build
pnpm typecheck
pnpm test
node scripts/verify-packed-install.mjs   # pack → install 後の同梱物を検証

# 3. コミット・タグ・push（タグ push が公開トリガー）
git commit -am "release: v0.x.y"
git tag v0.x.y
git push && git push --tags
```

以降はワークフローが自動で行う:

- ロックステップ（3 パッケージ同一バージョン）とタグ名の一致を検証
- build / typecheck / test / pack 検証
- `pnpm pack` → `npm publish`（workspace:* は pack 時に実バージョンへ解決される）
- 公開済みバージョンはスキップするため、失敗時の再実行は冪等
- dist-tags の `latest` がこのバージョンを指すことを確認
- GitHub Release を作成（リリースノートは自動生成）

失敗した場合や、ワークフロー追加前に push 済みのタグを公開する場合は、Actions タブから **workflow_dispatch で手動実行**できる（main の HEAD で実行される）。

## 手動で公開する場合（フォールバック）

Trusted Publishing が使えない状況では従来どおり手元から公開できる。`pnpm publish` は非対話環境で OTP を渡せないため、pack → `npm publish` を使う:

```sh
cd packages/core && pnpm pack --out /tmp/core.tgz
npm publish /tmp/core.tgz --access public --otp=XXXXXX
# vite-plugin / webpack-loader も同様
```

## 方針

- **ロックステップバージョニング**: 3 パッケージは同一バージョンで揃える。core の変換仕様とプラグインの期待が密結合のため、独立バージョンは対応表の管理コストに見合わない
- **タグ駆動リリース**: バージョン管理（changesets 等）は導入せず、タグ push を公開の意思表示とする。リリース頻度が上がってきたら changesets の導入を検討する
- **Trusted Publishing を使う理由**: 長命な npm トークンを GitHub Secrets に置くと漏洩リスクと更新コストがある。OIDC はジョブごとの短命トークンで、リポジトリ + ワークフローファイル名まで縛れる
