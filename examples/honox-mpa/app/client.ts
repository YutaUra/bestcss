import { createClient } from "honox/client";

// スタイルは dev / prod とも renderer の routeCssHrefs 経由で <link> される
// （dev は ?direct URL、本番はビルド済みアセット。issue #3 で経路を統一）
createClient();
