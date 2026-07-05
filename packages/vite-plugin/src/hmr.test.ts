import fs from "node:fs";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");
const ENTRY = path.join(FIXTURE_DIR, ".tmp-hmr-entry.ts");
const ENTRY_URL = "/.tmp-hmr-entry.ts";

// 値には色名ではなく padding を使う。Lightning CSS が色名を 16 進数へ
// 正規化する（blue → #00f）ため、色名は出力に残る保証がない
const sourceWithPadding = (padding: string): string =>
  [
    `import { css } from "@bestcss/core";`,
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

/**
 * 実ファイル保存を watcher イベントごと再現するテスト用ヘルパー。
 *
 * simulateFileChange（手動 invalidate）と別に用意する理由:
 * 実環境では保存すると watcher が発火してプラグインの hotUpdate が走る。
 * writeFileSync 由来の watcher 発火は環境依存のタイミング（macOS の
 * fsevents は遅く、Linux の inotify は速い）で、CI でだけ hotUpdate が
 * transformRequest より先に走り URL に ?t= が付く回帰があった。
 * emit で明示的に発火させ、この経路を全環境で決定的にテストする
 */
const emitWatcherChange = async (
  dev: ViteDevServer,
  content: string,
): Promise<void> => {
  fs.writeFileSync(ENTRY, content);
  dev.watcher.emit("change", ENTRY);
  // Vite の HMR 処理は非同期なので、entry の変換キャッシュが
  // 無効化される（= hotUpdate まで処理が届いた）のを待つ
  const graph = dev.environments.client.moduleGraph;
  await vi.waitFor(() => {
    const mod = graph.getModuleById(ENTRY);
    if (mod?.transformResult != null) {
      throw new Error("watcher イベントがまだ処理されていません");
    }
  });
};

/** 変換後コードから仮想 CSS モジュールの import URL を取り出すヘルパー */
const extractCssImportUrl = (code: string | undefined): string => {
  const match = (code ?? "").match(/import "([^"]*bestcss\.css[^"]*)"/);
  if (!match?.[1]) {
    throw new Error(`仮想 CSS の import が見つかりません: ${code}`);
  }
  return match[1];
};

afterEach(async () => {
  await server?.close();
  server = undefined;
  fs.rmSync(ENTRY, { force: true });
});

describe("dev サーバーの HMR", () => {
  it("css`` を編集すると import URL が変わり、新 URL から新しい CSS が配信される", async () => {
    // Arrange
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    const before = await dev.transformRequest(ENTRY_URL);
    const urlBefore = extractCssImportUrl(before?.code);

    // Act: ファイルを編集して再変換させる
    simulateFileChange(dev, sourceWithPadding("2px"));
    const after = await dev.transformRequest(ENTRY_URL);
    const urlAfter = extractCssImportUrl(after?.code);

    // Assert: ブラウザは ESM モジュールを URL 単位でキャッシュするため、
    // 内容が変わったら URL 自体が変わらなければ再取得されない
    expect(urlAfter).not.toBe(urlBefore);
    const cssModule = await dev.transformRequest(urlAfter);
    expect(cssModule?.code).toContain("2px");
    expect(cssModule?.code).not.toContain("1px");
  });

  it("同一内容での再変換では import URL が変わらない（不要な再取得をさせない）", async () => {
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    const before = await dev.transformRequest(ENTRY_URL);
    const urlBefore = extractCssImportUrl(before?.code);

    simulateFileChange(dev, sourceWithPadding("1px"));
    const after = await dev.transformRequest(ENTRY_URL);
    const urlAfter = extractCssImportUrl(after?.code);

    expect(urlAfter).toBe(urlBefore);
  });

  it("watcher 経由の保存でも、内容が同じなら import URL が変わらない", async () => {
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    const before = await dev.transformRequest(ENTRY_URL);
    const urlBefore = extractCssImportUrl(before?.code);

    await emitWatcherChange(dev, sourceWithPadding("1px"));
    const after = await dev.transformRequest(ENTRY_URL);
    const urlAfter = extractCssImportUrl(after?.code);

    // ?hash= 付き URL は内容アドレスなので、hotUpdate が仮想 CSS を
    // HMR 更新対象に含めると Vite が ?t= を付けて URL が変わってしまう
    expect(urlAfter).toBe(urlBefore);
  });

  it("css`` を全て削除すると CSS の import 自体がなくなる", async () => {
    fs.writeFileSync(ENTRY, sourceWithPadding("1px"));
    const dev = await startServer();
    await dev.transformRequest(ENTRY_URL);

    simulateFileChange(dev, SOURCE_WITHOUT_CSS);
    const after = await dev.transformRequest(ENTRY_URL);

    // import が消えれば Vite の HMR prune が古い style 要素を除去する
    expect(after?.code ?? "").not.toContain("bestcss.css");
  });
});
