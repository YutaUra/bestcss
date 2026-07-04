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
const RENAME_MAP = "dist/.best-css/rename-map.json";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [
        client(),
        bestCss({
          renameMapPath: RENAME_MAP,
          // ルート単位の CSS 分割。各ルートの import グラフから CSS を集めた
          // スタイルエントリを注入し、「admin 専用 CSS は admin だけ、
          // 共有 CSS は共有ファイル」の分割を Vite のチャンク分割に委ねる。
          // ルート → CSS の対応表は dist/.best-css/route-css.json に出力され、
          // renderer がルートに応じた <link> を注入する。
          // クライアント側の設定にのみ指定する（CSS の出力はクライアント
          // ビルドの責務のため）
          routeStyles: { dir: "app/routes" },
        }),
      ],
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
    plugins: [honox(), ssg({ entry }), bestCss({ renameMapPath: RENAME_MAP })],
  };
});
