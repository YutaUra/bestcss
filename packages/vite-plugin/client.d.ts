// 利用側プロジェクト向けの仮想モジュール型宣言。
// tsconfig の "types" に "@best-css/vite-plugin/client" を追加して使う
declare module "virtual:best-css/dev-styles" {}

declare module "virtual:best-css/route-css" {
  const manifest: Record<string, string[]> | null;
  export default manifest;
}
