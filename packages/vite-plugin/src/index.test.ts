import path from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE = path.resolve(import.meta.dirname, "__fixtures__/basic.ts");
const DEDUP_FIXTURE = path.resolve(
  import.meta.dirname,
  "__fixtures__/dedup/entry.ts",
);

/** fixture を vite build に通し、JS チャンクと CSS アセットを取り出すヘルパー */
async function buildFixture(
  entry: string = FIXTURE,
  options: { cssMinify?: boolean; minifyClassNames?: boolean } = {},
): Promise<{ js: string; css: string }> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [bestCss({ minifyClassNames: options.minifyClassNames })],
    build: {
      write: false,
      cssMinify: options.cssMinify ?? true,
      lib: {
        entry,
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
    const { js, css } = await buildFixture(FIXTURE, {
      minifyClassNames: false,
    });

    expect(js).not.toContain("css`");
    expect(js).toMatch(/"bc[a-z0-9]+"/);
    expect(css).toMatch(/\.bc[a-z0-9]+/);
    expect(css).toMatch(/color:\s*red/);
  });

  it("production build ではクラス名が短縮される（デフォルト有効）", async () => {
    const { js, css } = await buildFixture();

    // fixture のクラスは 1 つなので最短の "a" が割り当てられる
    expect(js).toMatch(/"a"/);
    expect(js).not.toMatch(/bc[a-z0-9]{4,}/);
    expect(css).toContain(".a");
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
  });

  it("出力 JS にランタイムコードが残らない（ゼロランタイム）", async () => {
    const { js } = await buildFixture();

    expect(js).not.toContain("@best-css/core");
    // css スタブ（実行時エラーを投げるコード）がバンドルされていないこと
    expect(js).not.toContain("ビルド時に変換");
  });

  it("複数ファイルの同一 css`` は最終 CSS アセットで 1 ルールに重複排除される", async () => {
    const { js, css } = await buildFixture(DEDUP_FIXTURE, {
      minifyClassNames: false,
    });

    // クラス名は内容ハッシュなので両ファイルで同一に収束している
    const classNames = [...new Set(js.match(/[`"]bc[a-z0-9]+[`"]/g) ?? [])];
    expect(classNames).toHaveLength(1);
    // CSS 側もルールが 1 回だけ出力される
    expect(css.match(/\.bc[a-z0-9]+/g)).toHaveLength(1);
  });

  it("cssMinify を無効にしても重複排除される（minifier の挙動に依存しない）", async () => {
    const { css } = await buildFixture(DEDUP_FIXTURE, {
      cssMinify: false,
      minifyClassNames: false,
    });

    expect(css.match(/\.bc[a-z0-9]+/g)).toHaveLength(1);
  });

  it("クラス名短縮と重複排除が両立する", async () => {
    const { css } = await buildFixture(DEDUP_FIXTURE);

    // 同一内容 2 ファイル分が 1 ルールに収束し、名前も短縮される
    expect(css.match(/\.a\b/g)).toHaveLength(1);
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
  });
});
