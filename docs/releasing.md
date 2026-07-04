> **Stability**: 🌊 living
> **最終更新**: 2026-07-05
> **直近の変更 ADR**: [ADR-0010](decisions/0010-mit-license.md)

# Releasing — bestcss

npm への公開手順。公開対象は `@bestcss/core` / `@bestcss/vite-plugin` / `@bestcss/webpack-loader` の 3 パッケージ（examples / bench は private）。

## 事前に一度だけ必要なもの

- npm の organization **`bestcss`**（スコープ `@bestcss/*` の公開に必要）
- `npm login` 済みであること
- GitHub リポジトリ（package.json の repository は `github.com/YutaUra/bestcss` を指している）

## 手順

```sh
# 1. バージョンを 3 パッケージ同時に上げる（当面はロックステップ運用）
#    packages/*/package.json の version を編集する

# 2. 検証
pnpm install
pnpm build
pnpm typecheck
pnpm test
node scripts/verify-packed-install.mjs   # pack → install 後の同梱物を検証

# 3. コミットとタグ
git commit -am "release: v0.x.y"
git tag v0.x.y

# 4. 公開（workspace:* は publish 時に実バージョンへ書き換えられる）
pnpm publish -r

# 5. push
git push && git push --tags
```

## 方針

- **ロックステップバージョニング**: 3 パッケージは同一バージョンで揃える。core の変換仕様とプラグインの期待が密結合のため、独立バージョンは対応表の管理コストに見合わない
- リリース頻度が上がってきたら changesets の導入を検討する
