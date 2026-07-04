// プラグインが解決する仮想モジュールの型宣言。
// 値の実体はビルド時に best-css プラグインの load() がインラインする
declare module "virtual:best-css/route-css" {
  const manifest: Record<string, string[]> | null;
  export default manifest;
}
