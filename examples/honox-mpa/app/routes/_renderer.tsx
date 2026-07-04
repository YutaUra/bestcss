import fs from "node:fs";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { Script } from "honox/server";

// ルート → CSS ファイル一覧の対応表（クライアントビルドが出力する）。
// renderer はサーバーでのみ動くため fs 読み込みでよい（ゼロランタイムは不変）
const routeCss: Record<string, string[]> | null = import.meta.env.PROD
  ? (JSON.parse(
      fs.readFileSync("dist/.best-css/route-css.json", "utf8"),
    ) as Record<string, string[]>)
  : null;

/** リクエストパスから、そのルートに必要な CSS ファイルを引く */
const cssLinksFor = (requestPath: string): string[] => {
  if (routeCss === null) {
    return [];
  }
  const trimmed = requestPath.replace(/^\/+|\/+$/g, "");
  const candidates = trimmed === "" ? ["index"] : [trimmed, `${trimmed}/index`];
  const files = new Set<string>();
  for (const [routeKey, cssFiles] of Object.entries(routeCss)) {
    // "_" 始まり（_renderer 等）は全ページ共通として常に含める
    if (routeKey.startsWith("_") || candidates.includes(routeKey)) {
      for (const file of cssFiles) {
        files.add(file);
      }
    }
  }
  return [...files];
};

export default jsxRenderer(({ children, title }) => {
  const c = useRequestContext();
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {title ? <title>{title}</title> : null}
        {/* dev では <Script> 経由の CSS import を Vite が <style> 注入する */}
        {cssLinksFor(c.req.path).map((href) => (
          <link href={`/${href}`} rel="stylesheet" />
        ))}
        <Script src="/app/client.ts" async />
      </head>
      <body>{children}</body>
    </html>
  );
});
