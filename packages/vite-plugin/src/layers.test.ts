import path from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

// issue #5 (A): カスケードレイヤー。順序の所有者は layers 設定であり、
// バンドル上の出現順や minifier の最適化に依存しないことを検証する
const ENTRY = path.resolve(
  import.meta.dirname,
  "__fixtures__/layers/entry.ts",
);
const LAYERS = ["base", "components", "utilities"];

async function buildLayers(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [bestCss({ minifyClassNames: false, layers: LAYERS })],
    build: {
      write: false,
      lib: { entry: ENTRY, formats: ["es"], fileName: "out" },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  const cssAsset = outputs.find(
    (o) => o.type === "asset" && o.fileName.endsWith(".css"),
  );
  if (cssAsset?.type !== "asset") {
    throw new Error("CSS アセットが出力されていません");
  }
  return String(cssAsset.source);
}

describe("カスケードレイヤー (issue #5)", () => {
  it("最終 CSS アセットの先頭に完全なレイヤー順宣言が付く", async () => {
    const css = await buildLayers();

    expect(
      css.trimStart().startsWith("@layer base, components, utilities;"),
    ).toBe(true);
  });

  it("各ルールが宣言したレイヤーに包まれて出力される", async () => {
    const css = await buildLayers();

    expect(css).toMatch(/@layer components\s*\{[\s\S]*111px/);
    expect(css).toMatch(/@layer utilities\s*\{[\s\S]*222px/);
  });
});
