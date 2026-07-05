import fs from "node:fs";
import path from "node:path";
import { build, createServer, type Rollup, type ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const SOURCE_ROOT = path.resolve(
  import.meta.dirname,
  "__fixtures__/route-styles",
);
// route-styles fixture を直接使わず専用コピーで動かす理由:
// このスイートは HMR テストで routes/index.ts を一時的に書き換える。
// vitest はテストファイルを並列ワーカーで実行するため、同じ fixture を
// ビルドする route-styles.test.ts がその書き換え中の内容を拾って
// flake になっていた（テストの独立性違反）。
// コピー先を __fixtures__ 配下に置くのは、fixture が import する
// @bestcss/core の解決（node_modules の探索チェーン）を保つため
const ROOT = path.resolve(
  import.meta.dirname,
  "__fixtures__/.tmp-dev-styles-root",
);
const TMP_ENTRY = path.join(ROOT, "dev-entry.tmp.ts");

let server: ViteDevServer | undefined;

beforeAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.cpSync(SOURCE_ROOT, ROOT, { recursive: true });
});

afterAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  fs.rmSync(TMP_ENTRY, { force: true });
  fs.rmSync(path.join(ROOT, "node_modules"), { recursive: true, force: true });
});

const startServer = async (): Promise<ViteDevServer> => {
  server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [bestCss({ ssr: { routesDir: "routes" } })],
  });
  return server;
};

describe("virtual:bestcss/dev-styles", () => {
  it("dev では全ルートのスタイルの import を生成する", async () => {
    const dev = await startServer();

    const result = await dev.transformRequest("virtual:bestcss/dev-styles");

    // ルート（index / admin）と共有モジュールのスタイルが集まる
    expect(result?.code).toContain("routes/index.ts.bestcss.css");
    expect(result?.code).toContain("routes/admin/index.ts.bestcss.css");
    expect(result?.code).toContain("shared.ts.bestcss.css");
  });

  it("本番ビルドでは空になる（ルート単位のスタイルエントリに置き換わる）", async () => {
    fs.writeFileSync(
      TMP_ENTRY,
      `import "virtual:bestcss/dev-styles";\nexport const entry = 1;\n`,
    );

    const result = await build({
      configFile: false,
      root: ROOT,
      logLevel: "silent",
      plugins: [bestCss({ ssr: { routesDir: "routes" } })],
      build: {
        write: false,
        lib: { entry: TMP_ENTRY, formats: ["es"], fileName: "out" },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(
      (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
    );
    const chunk = outputs.find((o) => o.type === "chunk");

    expect(chunk?.type === "chunk" && chunk.code).not.toContain(
      "bestcss.css",
    );
  });

  it("dev-styles 経由の仮想 CSS は元ファイルの編集が反映される", async () => {
    const dev = await startServer();
    const cssId = path.join(ROOT, "routes/index.ts") + ".bestcss.css";
    const before = await dev.transformRequest(cssId);
    expect(before?.code).toContain("101px");

    // 元ファイルを編集（fixture を汚さないよう終了時に戻す）
    const routeFile = path.join(ROOT, "routes/index.ts");
    const original = fs.readFileSync(routeFile, "utf8");
    try {
      fs.writeFileSync(routeFile, original.replace("101px", "999px"));
      // mtime の粒度対策として明示的に進める
      const future = new Date(Date.now() + 5_000);
      fs.utimesSync(routeFile, future, future);
      const graph = dev.environments.client.moduleGraph;
      const mod = graph.getModuleById(cssId);
      if (mod) {
        graph.invalidateModule(mod);
      }

      const after = await dev.transformRequest(cssId);

      expect(after?.code).toContain("999px");
    } finally {
      fs.writeFileSync(routeFile, original);
    }
  });
});
