import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";
import { matchRouteCss } from "./route-css-match.js";

// issue #2 の回帰テスト: 複数ルートが共有するコンポーネントの CSS が
// 1 ルートにだけ帰属し、他ルートが本番で無スタイルになる問題
const ROOT = path.resolve(
  import.meta.dirname,
  "__fixtures__/route-styles-shared",
);
const MANIFEST_PATH = path.join(ROOT, "node_modules/.bestcss/route-css.json");
const SHARING_ROUTES = [
  "login",
  "signup",
  "dashboard",
  "forgot-password",
  "reset-password",
];

afterEach(() => {
  fs.rmSync(path.join(ROOT, "node_modules"), { recursive: true, force: true });
});

async function buildAndGetManifest(): Promise<{
  manifest: Record<string, string[]>;
  cssByFile: Map<string, string>;
}> {
  const result = await build({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    plugins: [
      bestCss({ minifyClassNames: false, ssr: { routesDir: "routes" } }),
    ],
    build: {
      write: false,
      rollupOptions: { input: { client: path.join(ROOT, "client.ts") } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) =>
      (r as { output: Array<{ type: string; fileName: string; source?: unknown }> })
        .output,
  );
  return {
    manifest: JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Record<
      string,
      string[]
    >,
    cssByFile: new Map(
      outputs
        .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
        .map((o) => [o.fileName, String(o.source)]),
    ),
  };
}

describe("routeStyles: 複数ルートで共有されるスタイル (issue #2)", () => {
  it("共有コンポーネントの CSS が、共有する全ルートの routeCssHrefs 相当で解決できる", async () => {
    const { manifest, cssByFile } = await buildAndGetManifest();

    // 共有 Button のスタイル（font-display）が、5 ルートすべての
    // マッチ結果から辿れること。1 ルートへの誤帰属を検出する
    for (const route of SHARING_ROUTES) {
      const files = matchRouteCss(manifest, `/${route}`);
      const cssText = files.map((f) => cssByFile.get(f) ?? "").join("\n");
      expect(cssText, `route: ${route}`).toContain("font-display");
    }
  });

  it("ルート固有のスタイルは他ルートに混入しない", async () => {
    const { manifest, cssByFile } = await buildAndGetManifest();

    const loginCss = matchRouteCss(manifest, "/login")
      .map((f) => cssByFile.get(f) ?? "")
      .join("\n");
    expect(loginCss).not.toContain("555px");

    const dashboardCss = matchRouteCss(manifest, "/dashboard")
      .map((f) => cssByFile.get(f) ?? "")
      .join("\n");
    expect(dashboardCss).toContain("555px");
  });
});
