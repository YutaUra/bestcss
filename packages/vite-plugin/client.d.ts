// 利用側プロジェクト向けの仮想モジュール型宣言。
// tsconfig の "types" に "@bestcss/vite-plugin/client" を追加して使う
declare module "virtual:bestcss/dev-styles" {}

declare module "virtual:bestcss/route-css" {
  const manifest: Record<string, string[]> | null;
  export default manifest;
}
