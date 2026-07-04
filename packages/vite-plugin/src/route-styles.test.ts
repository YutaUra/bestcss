import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const ROOT = path.resolve(import.meta.dirname, "__fixtures__/route-styles");
const MANIFEST_PATH = path.join(
  ROOT,
  "node_modules/.bestcss/route-css.json",
);

afterEach(() => {
  fs.rmSync(path.join(ROOT, "node_modules"), { recursive: true, force: true });
});

interface RouteStylesBuild {
  /** ルートキー → CSS ファイル名の一覧 */
  manifest: Record<string, string[]>;
  /** CSS ファイル名 → 中身 */
  cssByFile: Map<string, string>;
  jsChunkNames: string[];
}

async function buildRouteStyles(): Promise<RouteStylesBuild> {
  const result = await build({
    configFile: false,
    root: ROOT,
    logLevel: "silent",
    plugins: [
      bestCss({
        minifyClassNames: false,
        ssr: { routesDir: "routes" },
      }),
    ],
    build: {
      write: false,
      rollupOptions: {
        input: { client: path.join(ROOT, "client.ts") },
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) =>
      (
        r as {
          output: Array<{
            type: string;
            fileName: string;
            source?: unknown;
            code?: string;
          }>;
        }
      ).output,
  );

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("route-css.json が出力されていません");
  }
  const cssByFile = new Map(
    outputs
      .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
      .map((o) => [o.fileName, String(o.source)]),
  );
  return {
    manifest: JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Record<
      string,
      string[]
    >,
    cssByFile,
    jsChunkNames: outputs
      .filter((o) => o.type === "chunk")
      .map((o) => o.fileName),
  };
}

describe("routeStyles: ルート単位の CSS 分割", () => {
  it("ルートごとの CSS ファイル一覧を manifest に書き出す", async () => {
    const { manifest } = await buildRouteStyles();

    expect(Object.keys(manifest).sort()).toEqual(["admin/index", "index"]);
    expect(manifest["index"]!.length).toBeGreaterThan(0);
    expect(manifest["admin/index"]!.length).toBeGreaterThan(0);
  });

  it("ルート専用のスタイルはそのルートの CSS にのみ含まれる", async () => {
    const { manifest, cssByFile } = await buildRouteStyles();

    const cssTextOf = (route: string): string =>
      manifest[route]!.map((f) => cssByFile.get(f) ?? "").join("\n");

    // admin 専用スタイル（202px）は admin のみ、index 専用（101px）は index のみ
    expect(cssTextOf("admin/index")).toContain("202px");
    expect(cssTextOf("admin/index")).not.toContain("101px");
    expect(cssTextOf("index")).toContain("101px");
    expect(cssTextOf("index")).not.toContain("202px");
  });

  it("共有スタイルは共有 CSS ファイルとして 1 つだけ出力され、両ルートから参照される", async () => {
    const { manifest, cssByFile } = await buildRouteStyles();

    const sharedFiles = [...cssByFile.entries()]
      .filter(([, cssText]) => cssText.includes("303px"))
      .map(([fileName]) => fileName);
    expect(sharedFiles).toHaveLength(1);
    expect(manifest["index"]).toContain(sharedFiles[0]);
    expect(manifest["admin/index"]).toContain(sharedFiles[0]);
  });

  it("スタイル収集用の仮想エントリの JS チャンクは出力に残らない", async () => {
    const { jsChunkNames } = await buildRouteStyles();

    expect(jsChunkNames.some((n) => n.includes("bestcss-route"))).toBe(false);
  });
});
