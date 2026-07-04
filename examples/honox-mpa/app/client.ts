import { createClient } from "honox/client";

// dev のみ: 全スタイルをモジュールチェーン経由で読み込む（HMR が効く）。
// 本番はルート単位のスタイルエントリ（routeStyles）が CSS を出力し、
// renderer が対応する <link> を注入するため、この import はビルドで消える
if (import.meta.env.DEV) {
  void import("./components/ui.js");
  void import("./components/admin-panel.js");
}

createClient();
