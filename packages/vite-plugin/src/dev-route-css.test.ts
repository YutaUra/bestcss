import http from "node:http";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

// issue #3: dev / prod 非対称の解消。island を持たない純 SSR でも、
// renderer が routeCssHrefs を map するだけで dev もスタイルが当たること
const ROOT = path.resolve(import.meta.dirname, "__fixtures__/route-styles");

let server: ViteDevServer | undefined;
let httpServer: http.Server | undefined;

afterEach(async () => {
  httpServer?.close();
  httpServer = undefined;
  await server?.close();
  server = undefined;
});

const start = async (): Promise<number> => {
  server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [bestCss({ ssr: { routesDir: "routes" } })],
  });
  httpServer = http.createServer(server.middlewares);
  await new Promise<void>((resolve) => httpServer!.listen(0, resolve));
  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("ポートを取得できません");
  }
  return address.port;
};

describe("dev の routeCssHrefs 経路 (issue #3)", () => {
  it("dev では manifest 仮想モジュールがルートごとの dev 用 href を返す", async () => {
    await start();

    const result = await server!.transformRequest("virtual:bestcss/route-css");

    // ルートキーと ?direct 付き URL を含む manifest がインラインされる
    expect(result?.code).toContain('"index"');
    expect(result?.code).toContain('"admin/index"');
    expect(result?.code).toContain(".bestcss.css?direct");
    expect(result?.code).not.toContain("export default null");
  });

  it("dev 用 href を fetch すると生の CSS が text/css で配信される", async () => {
    const port = await start();

    const response = await fetch(
      `http://localhost:${port}/routes/index.ts.bestcss.css?direct`,
    );

    expect(response.headers.get("content-type")).toContain("text/css");
    const body = await response.text();
    // JS ラッパー（css-as-JS モジュール）ではなく生の CSS であること。
    // content-type だけの検証では JS 本文でも通ってしまう
    expect(body).not.toContain("import");
    expect(body.trim()).toMatch(/^\./);
    expect(body).toContain("101px");
  });
});
