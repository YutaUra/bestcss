import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const MPA_ROOT = path.resolve(import.meta.dirname, "__fixtures__/mpa");

/** MPA fixture をビルドし、CSS アセットの一覧を返すヘルパー */
async function buildMpa(): Promise<string[]> {
  const result = await build({
    configFile: false,
    root: MPA_ROOT,
    logLevel: "silent",
    plugins: [bestCss()],
    build: {
      write: false,
      rollupOptions: {
        input: {
          a: path.join(MPA_ROOT, "a.html"),
          b: path.join(MPA_ROOT, "b.html"),
        },
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Array<{ type: string; fileName: string; source?: unknown }> }).output,
  );
  return outputs
    .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
    .map((o) => String((o as { source: unknown }).source));
}

describe("MPA ビルドの CSS 分割", () => {
  it("各ページのスタイルはそのページの CSS にのみ含まれる", async () => {
    const cssAssets = await buildMpa();

    const withA = cssAssets.filter((css) => css.includes("111px"));
    const withB = cssAssets.filter((css) => css.includes("222px"));
    expect(withA).toHaveLength(1);
    expect(withB).toHaveLength(1);
    // ページ A の CSS に B のスタイルが混入しない（逆も同様）
    expect(withA[0]).not.toContain("222px");
    expect(withB[0]).not.toContain("111px");
  });

  it("共有モジュールのスタイルは全 CSS を通して 1 回だけ出力される", async () => {
    const cssAssets = await buildMpa();

    const occurrences = cssAssets.filter((css) =>
      css.includes("333px"),
    ).length;
    expect(occurrences).toBe(1);
  });
});
