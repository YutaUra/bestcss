// プラグインが解決する仮想モジュールの型宣言。
// 値の実体はビルド時に bestcss プラグインの load() がインラインする
declare module "virtual:bestcss/route-css" {
  const manifest: Record<string, string[]> | null;
  export default manifest;
}
