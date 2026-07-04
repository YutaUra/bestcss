import { bestCss } from "@bestcss/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), bestCss()],
  css: {
    // DevTools の Styles ペインから css`` の元位置へ辿れるようにする
    // （Vite 標準のオプション。デフォルト無効）
    devSourcemap: true,
  },
});
