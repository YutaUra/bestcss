import { jsxRenderer } from "hono/jsx-renderer";
import { Script } from "honox/server";

export default jsxRenderer(({ children, title }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {title ? <title>{title}</title> : null}
        {/*
          dev では <Script> 経由でロードされる client.ts の CSS import が
          Vite により <style> として注入されるため <link> は不要。
          prod では assetFileNames で固定した CSS を直接参照する
        */}
        {import.meta.env.PROD ? (
          <link href="/static/assets/style.css" rel="stylesheet" />
        ) : null}
        <Script src="/app/client.ts" async />
      </head>
      <body>{children}</body>
    </html>
  );
});
