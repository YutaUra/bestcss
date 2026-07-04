import path from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");

describe("dev サーバーの CSS ソースマップ", () => {
  it("css.devSourcemap 有効時、スタイルのソースマップが元の tsx を指す", async () => {
    // Arrange
    const server = await createServer({
      configFile: false,
      root: FIXTURE_DIR,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true },
      css: { devSourcemap: true },
      plugins: [bestCss()],
    });

    try {
      // Act: エントリを変換して仮想 CSS モジュールを取得する
      const entry = await server.transformRequest("/basic.ts");
      const cssUrl = entry?.code.match(
        /import "([^"]*best-css\.css[^"]*)"/,
      )?.[1];
      expect(cssUrl).toBeDefined();
      const cssModule = await server.transformRequest(cssUrl!);

      // Assert: 埋め込まれたソースマップの sources が仮想モジュールではなく
      // 元の tsx ファイルを指す（DevTools の Styles ペインから辿れる条件）
      const base64 = cssModule?.code.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
      expect(base64).toBeDefined();
      const map = JSON.parse(Buffer.from(base64!, "base64").toString()) as {
        sources: string[];
      };
      expect(map.sources.some((source) => source.endsWith("basic.ts"))).toBe(
        true,
      );
    } finally {
      await server.close();
    }
  });
});
