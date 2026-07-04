import { createClient } from "honox/client";

// ルート（サーバー側）でしか使わないコンポーネントのスタイルも
// クライアントビルドの CSS に収集するための side-effect import。
// islands のスタイルは HonoX が自動でクライアントビルドに含めるが、
// サーバー専用モジュールの css`` はここから辿れる必要がある
import "./components/ui.js";

createClient();
