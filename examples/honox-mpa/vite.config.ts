import { bestCss } from "@best-css/vite-plugin";
import ssg from "@hono/vite-ssg";
import honox from "honox/vite";
import client from "honox/vite/client";
import { defineConfig } from "vite";

const entry = "./app/server.ts";

// HonoX は client / server の 2 パスビルドで、SSR された HTML のクラス名と
// 配信 CSS が別ビルドから出る。renameMapPath を共有すると、client ビルドが
// 確定した短縮名の表を server ビルドが読んで同じ名前に書き換えるため、
// SSR 構成でもクラス名短縮を有効にできる（build は client → server の順）
const bestCssPlugin = () =>
  bestCss({ renameMapPath: "dist/.best-css/rename-map.json" });

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [client(), bestCssPlugin()],
      build: {
        // SSR 済みの HTML に最初から全スタイルを当てるため、island 分も
        // 含めて CSS を 1 ファイルに集約する（分割したままだと island の
        // スタイルが JS ロード後に届き、一瞬スタイルなしで表示される）
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            // renderer から <link> で参照できるよう CSS の出力名を固定する
            assetFileNames: "static/assets/[name].[ext]",
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
