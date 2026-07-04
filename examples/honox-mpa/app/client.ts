import { createClient } from "honox/client";

// dev: 全ルートのスタイルを HMR 付きで読み込む（本番ビルドでは空になり、
// ルート単位のスタイルエントリ + <link> 注入に置き換わる）
import "virtual:bestcss/dev-styles";

createClient();
