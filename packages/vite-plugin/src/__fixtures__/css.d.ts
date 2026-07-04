// fixture が import する CSS ファイル（Vite が処理する）の型宣言。
// TS 6 は型宣言のない side-effect import をエラーにする（TS2882）
declare module "*.css";
