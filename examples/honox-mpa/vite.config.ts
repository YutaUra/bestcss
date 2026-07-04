import { bestCss } from "@best-css/vite-plugin";
import ssg from "@hono/vite-ssg";
import honox from "honox/vite";
import client from "honox/vite/client";
import { defineConfig } from "vite";

const entry = "./app/server.ts";

// minifyClassNames を無効にする理由: HonoX は client / server の 2 パス
// ビルドで、SSR された HTML のクラス名と配信 CSS が別ビルドから出る。
// 頻度順の短縮はビルドごとに割り当てが変わり両者の一致を壊すが、
// 内容ハッシュ名なら独立したビルド間でも決定的に一致する
const bestCssPlugin = () => bestCss({ minifyClassNames: false });

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
