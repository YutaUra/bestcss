import fs from "node:fs";
import path from "node:path";
// Vite 6（Rollup ベース）でのチャンク統合の挙動差を検証する。
// issue #2 は Vite 6 環境で報告された
import { build as buildVite6 } from "vite6";

// vite6 エイリアスの型は vite 8 のものが当たるため、境界で緩める
const build = buildVite6 as unknown as (config: object) => Promise<unknown>;
import { afterEach, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";
import { matchRouteCss } from "./route-css-match.js";

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

describe("routeStyles on Vite 6 (issue #2)", () => {
  it("共有コンポーネントの CSS が全共有ルートから解決できる", async () => {
    const result = (await build({
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
    })) as { output: Array<{ type: string; fileName: string; source?: unknown }> };

    const manifest = JSON.parse(
      fs.readFileSync(MANIFEST_PATH, "utf8"),
    ) as Record<string, string[]>;
    const cssByFile = new Map(
      result.output
        .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
        .map((o) => [o.fileName, String(o.source)]),
    );

    for (const route of SHARING_ROUTES) {
      const files = matchRouteCss(manifest, `/${route}`);
      const cssText = files.map((f) => cssByFile.get(f) ?? "").join("\n");
      expect(cssText, `route: ${route}`).toContain("font-display");
    }
  });
});
