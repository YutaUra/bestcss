import fs from "node:fs";
import path from "node:path";
import { build, type Rollup } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bestCss, type BestCssOptions } from "./index.js";

const FIXTURE = path.resolve(import.meta.dirname, "__fixtures__/basic.ts");
const PLAIN_FIXTURE = path.resolve(
  import.meta.dirname,
  "__fixtures__/plain.ts",
);
const MAP_PATH = path.resolve(
  import.meta.dirname,
  "__fixtures__/.tmp-rename-map.json",
);

async function buildWith(options: {
  ssr?: boolean;
  entry?: string;
  plugin?: BestCssOptions;
}): Promise<{ js: string; css: string | null }> {
  const entry = options.entry ?? FIXTURE;
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [bestCss(options.plugin)],
    build: {
      write: false,
      ...(options.ssr
        ? { ssr: entry, rollupOptions: { external: ["@best-css/core"] } }
        : { lib: { entry, formats: ["es"], fileName: "out" } }),
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
  return {
    js: chunk.code,
    css: cssAsset?.type === "asset" ? String(cssAsset.source) : null,
  };
}

afterEach(() => {
  fs.rmSync(MAP_PATH, { force: true });
});

describe("リネーム表の共有（SSR 構成でのクラス名短縮）", () => {
  it("クライアントビルドが確定したリネーム表を書き出す", async () => {
    const { js } = await buildWith({ plugin: { renameMapPath: MAP_PATH } });

    const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) as Record<
      string,
      string
    >;
    const entries = Object.entries(map);
    expect(entries.length).toBeGreaterThan(0);
    // 表の値（短縮名）が実際の出力と一致している
    const [original, renamed] = entries[0]!;
    expect(original).toMatch(/^bc[a-z0-9]+$/);
    expect(js).toContain(`"${renamed}"`);
  });

  it("サーバービルドは表を読み、クライアントと同じ短縮名を使う", async () => {
    // Arrange: クライアントビルドで表を確定させる
    const client = await buildWith({ plugin: { renameMapPath: MAP_PATH } });
    const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) as Record<
      string,
      string
    >;
    const renamed = Object.values(map)[0]!;

    // Act: サーバービルドが同じ表を消費する
    const server = await buildWith({
      ssr: true,
      plugin: { renameMapPath: MAP_PATH },
    });

    // Assert: SSR コードのクラス名リテラル = クライアント CSS のクラス名
    expect(server.js).toContain(`"${renamed}"`);
    expect(server.js).not.toMatch(/"bc[a-z0-9]+"/);
    expect(client.css).toContain(`.${renamed}`);
  });

  it("サーバービルドで表が見つからない場合は原因が分かるエラーになる", async () => {
    await expect(
      buildWith({ ssr: true, plugin: { renameMapPath: MAP_PATH } }),
    ).rejects.toThrow(/クライアントビルド/);
  });

  it("表なしのサーバービルドは短縮しない（独自の頻度で短縮すると CSS と不整合になる）", async () => {
    const { js } = await buildWith({ ssr: true });

    // デフォルト（minifyClassNames: true）でも bc ハッシュ名のまま
    expect(js).toMatch(/"bc[a-z0-9]+"/);
  });

  it("CSS アセットを持たないビルドは既存の表を上書きしない", async () => {
    // css`` を含むクライアントビルドが書いた表を…
    await buildWith({ plugin: { renameMapPath: MAP_PATH } });
    const before = fs.readFileSync(MAP_PATH, "utf8");
    expect(before).not.toBe("{}");

    // css`` を含まないビルド（SSG 等が走らせる空のクライアント環境に相当）が
    // 空の表で上書きしてはならない
    await buildWith({
      entry: PLAIN_FIXTURE,
      plugin: { renameMapPath: MAP_PATH },
    });

    expect(fs.readFileSync(MAP_PATH, "utf8")).toBe(before);
  });
});
