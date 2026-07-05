# SSR / MPA フレームワークとの統合

対象: HonoX など、client / server の 2 パスビルドを行う Vite ベースのフレームワーク。

## 設定

`ssr` オプションを **client / server どちらのビルド設定にも同じ値で**渡す:

```ts
// vite.config.ts（client / server 共通）
bestCss({ ssr: { routesDir: "app/routes" } })
// ルート単位の CSS 分割が不要なら
bestCss({ ssr: true })
```

これで内部的に次が有効になる:

1. **クラス名短縮のリネーム表をビルド間で自動共有** — SSR された HTML と配信 CSS の短縮名が一致する。ビルドは **client → server の順**（順序違反は明示的なエラーで検出される）
2. **SSR ビルドに CSS import を付与しない** — サーバーバンドルに必要なのはクラス名だけ
3. **ルート単位の CSS 分割**（`routesDir` 指定時） — ルート専用 CSS はそのルートにのみ、共有 CSS は共有ファイルとして配信される

## renderer への `<link>` 注入

```tsx
// app/routes/_renderer.tsx
import { routeCssHrefs } from "@bestcss/vite-plugin/route-css";

{routeCssHrefs(c.req.path).map((href) => (
  <link href={href} rel="stylesheet" />
))}
```

ルート → CSS の対応表はビルド時にインラインされるため、実行時のファイルアクセスは不要（serverless でも動く）。dev では空配列を返す。

制限: 動的セグメント（`$id` 等）のパスマッチングは未対応。

## dev のスタイル読み込み

クライアントエントリで仮想モジュールを 1 行 import する。dev では全ルートのスタイルを HMR 付きで収集し、本番ビルドでは空になる:

```ts
// app/client.ts
import "virtual:bestcss/dev-styles";
```

仮想モジュールの型は tsconfig に追加する:

```json
{ "compilerOptions": { "types": ["vite/client", "@bestcss/vite-plugin/client"] } }
```

## リネーム表を使わない選択肢

`minifyClassNames: false` にすると内容ハッシュ名（`bc...`）のまま出力される。内容ハッシュは独立したビルド間でも決定的に一致するため、表の共有なしで HTML と CSS が一致する（[core: 内部のしくみ](../../core/docs/02-how-it-works.md) 参照）。

## routesDir を使わない場合の CSS 配信（ssr: true のみ）

ルート単位分割が不要なら、CSS はクライアントビルドの通常のグラフから出力される。スタイルは islands などクライアントに入るモジュール経由で収集されるため、ルート専用モジュールのスタイルはクライアントエントリから side-effect import で集める。`<link>` は出力名を固定して張るのが簡単:

```ts
// vite.config.ts（client）
build: {
  cssCodeSplit: false,
  rollupOptions: { output: { assetFileNames: "static/assets/[name].[ext]" } },
}
```

```tsx
// renderer（本番のみ）
<link href="/static/assets/style.css" rel="stylesheet" />
```
