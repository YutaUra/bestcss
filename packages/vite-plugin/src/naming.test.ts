import path from "node:path";
import type { NamingStrategy } from "@bestcss/core";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE = path.resolve(import.meta.dirname, "__fixtures__/basic.ts");

/** 命名戦略を指定して fixture をビルドし、JS と CSS を取り出す */
async function buildWithNaming(
  naming: NamingStrategy,
  options: { minifyClassNames?: boolean } = {},
): Promise<{ js: string; css: string }> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      bestCss({ naming, minifyClassNames: options.minifyClassNames ?? false }),
    ],
    build: {
      write: false,
      cssMinify: true,
      lib: { entry: FIXTURE, formats: ["es"], fileName: "out" },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  const chunk = outputs.find((o) => o.type === "chunk");
  const cssAsset = outputs.find(
    (o) => o.type === "asset" && o.fileName.endsWith(".css"),
  );
  if (chunk?.type !== "chunk" || cssAsset?.type !== "asset") {
    throw new Error("JS チャンクまたは CSS アセットが出力されていません");
  }
  return { js: chunk.code, css: String(cssAsset.source) };
}

describe("naming オプション", () => {
  it("注入した className で JS と CSS の両方のクラス名が決まる", async () => {
    // Arrange / Act
    const { js, css } = await buildWithNaming({
      className: ({ defaultName }) => `app-${defaultName}`,
    });

    // Assert
    expect(js).toMatch(/"app-bc[0-9a-z]{7}"/);
    expect(css).toMatch(/\.app-bc[0-9a-z]{7}\{/);
  });

  it("注入した hash がクラス名のハッシュ部分に反映される", async () => {
    const { js, css } = await buildWithNaming({ hash: () => "zzz" });

    expect(js).toContain('"bczzz"');
    expect(css).toContain(".bczzz{");
  });

  it("接頭辞を宣言すれば、注入した名前でもクラス名短縮が効く", async () => {
    // Arrange / Act
    const { js, css } = await buildWithNaming(
      {
        className: ({ defaultName }) => `app-${defaultName}`,
        classNamePrefixes: ["app-"],
      },
      { minifyClassNames: true },
    );

    // Assert
    expect(js).toMatch(/"[a-z]"/);
    expect(js).not.toMatch(/app-bc/);
    expect(css).not.toMatch(/app-bc/);
  });
});
