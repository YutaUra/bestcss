import path from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss, type BestCssOptions } from "./index.js";

const buildCss = async (
  fixture: string,
  options: BestCssOptions = {},
): Promise<string> => {
  const root = path.resolve(import.meta.dirname, "__fixtures__", fixture);
  const result = await build({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [bestCss(options)],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: {
        entry: path.join(root, "entry.ts"),
        formats: ["es"],
        fileName: "out",
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  return outputs
    .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
    .map((o) => String((o as { source: unknown }).source))
    .join("\n");
};

describe("targets: ブラウザターゲットへのダウンレベル", () => {
  it("targets オプション（browserslist クエリ）でネストのフラット化とプレフィックス付与が行われる", async () => {
    const cssText = await buildCss("targets", { targets: "safari 15" });

    expect(cssText).toContain("-webkit-user-select");
    expect(cssText).not.toContain("&");
  });

  it("オプション未指定ならプロジェクトの browserslist 設定を自動検出する", async () => {
    const cssText = await buildCss("targets-browserslist");

    expect(cssText).toContain("-webkit-user-select");
    expect(cssText).not.toContain("&");
  });

  it("targets がどこにもなければダウンレベルしない（生 CSS のまま）", async () => {
    const cssText = await buildCss("targets");

    expect(cssText).toContain("&:hover");
    expect(cssText).not.toContain("-webkit-user-select");
  });
});
