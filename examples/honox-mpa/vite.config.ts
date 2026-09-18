import { bestCss } from "@bestcss/vite-plugin";
import ssg from "@hono/vite-ssg";
import honox from "honox/vite";
import client from "honox/vite/client";
import { defineConfig } from "vite";

const entry = "./app/server.ts";

// SSR プロジェクトであることを宣言する。client / server 両方の設定に
// 同じ値を渡せばよく、どの環境で何をするかはプラグインが判断する:
// - クラス名短縮のリネーム表をビルド間で自動共有（HTML と CSS の一致）
// - routesDir 指定でルート単位の CSS 分割（admin 専用 CSS は admin だけ）
// minifyClassNames を有効にしているのは、client → server のリネーム表共有を
// CI のビルドで実際に通し続けるため（これを通す example が他にない）
const bestCssPlugin = () =>
  bestCss({ ssr: { routesDir: "app/routes" }, minifyClassNames: true });

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [client(), bestCssPlugin()],
      build: {
        rollupOptions: {
          output: {
            assetFileNames: "static/assets/[name]-[hash].[ext]",
          },
        },
      },
    };
  }
  return {
    build: { emptyOutDir: false },
    plugins: [honox(), ssg({ entry }), bestCssPlugin()],
  };
});
