import path from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE = path.resolve(import.meta.dirname, "__fixtures__/basic.ts");

/** fixture を vite build に通し、JS チャンクと CSS アセットを取り出すヘルパー */
async function buildFixture(): Promise<{ js: string; css: string }> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [bestCss()],
    build: {
      write: false,
      lib: {
        entry: FIXTURE,
        formats: ["es"],
        fileName: "out",
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  const chunk = outputs.find((o) => o.type === "chunk");
  const cssAsset = outputs.find(
    (o) => o.type === "asset" && o.fileName.endsWith(".css"),
  );
  if (chunk?.type !== "chunk") {
    throw new Error("JS チャンクが出力されていません");
  }
  if (cssAsset?.type !== "asset") {
    throw new Error("CSS アセットが出力されていません");
  }
  return { js: chunk.code, css: String(cssAsset.source) };
}

describe("bestCss プラグイン", () => {
  it("Vite が識別できるプラグイン名 best-css を持つ", () => {
    const plugin = bestCss();

    expect(plugin.name).toBe("best-css");
  });

  it("vite build で css`` がクラス名に置換され、CSS がアセットとして出力される", async () => {
    const { js, css } = await buildFixture();

    expect(js).not.toContain("css`");
    expect(js).toMatch(/"bc[a-z0-9]+"/);
    expect(css).toMatch(/\.bc[a-z0-9]+/);
    expect(css).toMatch(/color:\s*red/);
  });

  it("出力 JS にランタイムコードが残らない（ゼロランタイム）", async () => {
    const { js } = await buildFixture();

    expect(js).not.toContain("@best-css/core");
    // css スタブ（実行時エラーを投げるコード）がバンドルされていないこと
    expect(js).not.toContain("ビルド時に変換");
  });
});
