import { routeCssHrefs } from "@best-css/vite-plugin/route-css";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { Script } from "honox/server";

export default jsxRenderer(({ children, title }) => {
  const c = useRequestContext();
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {title ? <title>{title}</title> : null}
        {/* ルートに必要な CSS だけを <link> する（dev では空 = Vite が注入） */}
        {routeCssHrefs(c.req.path).map((href) => (
          <link href={href} rel="stylesheet" />
        ))}
        <Script src="/app/client.ts" async />
      </head>
      <body>{children}</body>
    </html>
  );
});
