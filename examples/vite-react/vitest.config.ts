import { bestCss } from "@best-css/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// bestCss() を入れないと css`` がテスト実行時に評価されてエラーになる
// （ビルド時変換が前提のため）。Vitest は Vite ベースなので
// vite.config.ts と同じプラグインを並べるだけでよい
export default defineConfig({
  plugins: [react(), bestCss()],
  test: {
    environment: "node",
  },
});
