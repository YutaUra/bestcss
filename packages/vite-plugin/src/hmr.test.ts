import fs from "node:fs";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");
const ENTRY = path.join(FIXTURE_DIR, ".tmp-hmr-entry.ts");
const ENTRY_URL = "/.tmp-hmr-entry.ts";
const VIRTUAL_CSS_ID = `${ENTRY}.best-css.css`;

// 値には色名ではなく padding を使う。Lightning CSS が色名を 16 進数へ
// 正規化する（blue → #00f）ため、色名は出力に残る保証がない
const sourceWithPadding = (padding: string): string =>
  [
    `import { css } from "@best-css/core";`,
    `export const cls = css\`padding: ${padding};\`;`,
  ].join("\n");

const SOURCE_WITHOUT_CSS = `export const cls = "plain";`;

let server: ViteDevServer | undefined;

const startServer = async (): Promise<ViteDevServer> => {
  server = await createServer({
    configFile: false,
    root: FIXTURE_DIR,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [bestCss()],
  });
  return server;
};

/** ファイル変更時に Vite が行う invalidate を再現するテスト用ヘルパー */
const simulateFileChange = (dev: ViteDevServer, content: string): void => {
  fs.writeFileSync(ENTRY, content);
  const graph = dev.environments.client.moduleGraph;
  const mod = graph.getModuleById(ENTRY);
  if (!mod) {
    throw new Error("entry モジュールがモジュールグラフに存在しません");
  }
  graph.invalidateModule(mod);
};

afterEach(async () => {
  await server?.close();
  server = undefined;
  fs.rmSync(ENTRY, { force: true });
});

describe("dev サーバーの HMR", () => {
  it("css`` を編集すると仮想 CSS モジュールが新しい内容で配信される", async () => {
    // Arrange
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    await dev.transformRequest(ENTRY_URL);
    const before = await dev.transformRequest(VIRTUAL_CSS_ID);
    expect(before?.code).toContain("1px");

    // Act: ファイルを編集して再変換させる
    simulateFileChange(dev, sourceWithPadding("2px"));
    await dev.transformRequest(ENTRY_URL);

    // Assert: 仮想 CSS モジュールに編集が反映されている
    const after = await dev.transformRequest(VIRTUAL_CSS_ID);
    expect(after?.code).toContain("2px");
    expect(after?.code).not.toContain("1px");
  });

  it("css`` を全て削除すると古いスタイルが配信されなくなる", async () => {
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    await dev.transformRequest(ENTRY_URL);
    await dev.transformRequest(VIRTUAL_CSS_ID);

    simulateFileChange(dev, SOURCE_WITHOUT_CSS);
    await dev.transformRequest(ENTRY_URL);

    // 取り残された仮想 CSS モジュールへのリクエストにも古い CSS を返さない
    const after = await dev.transformRequest(VIRTUAL_CSS_ID);
    expect(after?.code ?? "").not.toContain("1px");
  });
});
