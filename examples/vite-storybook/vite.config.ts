import { bestCss } from "@best-css/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Storybook（react-vite フレームワーク）はこの vite.config.ts を
// 読み込んでマージするため、Storybook 側の追加設定なしで
// best-css の変換が dev / build 両方で効く
export default defineConfig({
  plugins: [react(), bestCss()],
});
