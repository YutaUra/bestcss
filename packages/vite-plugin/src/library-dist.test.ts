import fs from "node:fs";
import path from "node:path";
import { build, type Rollup } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const LIB_SRC = path.resolve(import.meta.dirname, "__fixtures__/library-ui");
const CONSUMER = path.resolve(
  import.meta.dirname,
  "__fixtures__/library-consumer",
);
const FAKE_UI = path.join(CONSUMER, "node_modules/fake-ui");

/**
 * 配布モデルの前段: ライブラリ作者側のビルド。
 * minifyClassNames: false で bc 名（内容ハッシュ）のまま出荷し、
 * 最終的な短縮は利用側アプリのビルドに委ねる
 */
async function buildLibraryIntoConsumer(): Promise<void> {
  const result = await build({
    configFile: false,
    root: LIB_SRC,
    logLevel: "silent",
    plugins: [bestCss({ minifyClassNames: false })],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: path.join(LIB_SRC, "index.ts"),
        formats: ["es"],
        fileName: "index",
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  fs.rmSync(FAKE_UI, { recursive: true, force: true });
  fs.mkdirSync(path.join(FAKE_UI, "dist"), { recursive: true });
  for (const output of outputs) {
    const content =
      output.type === "chunk" ? output.code : String(output.source);
    const name = output.fileName.endsWith(".css")
      ? "style.css"
      : output.fileName;
    fs.writeFileSync(path.join(FAKE_UI, "dist", name), content);
  }
  fs.writeFileSync(
    path.join(FAKE_UI, "package.json"),
    JSON.stringify({
      name: "fake-ui",
      version: "1.0.0",
      type: "module",
      // CSS import がツリーシェイクで落ちないための宣言（docs の定石どおり）
      sideEffects: ["**/*.css"],
      exports: {
        ".": "./dist/index.js",
        "./style.css": "./dist/style.css",
      },
    }),
  );
}

async function buildConsumer(): Promise<{ js: string; css: string }> {
  const result = await build({
    configFile: false,
    root: CONSUMER,
    logLevel: "silent",
    plugins: [bestCss()],
    build: {
      write: false,
      lib: {
        entry: path.join(CONSUMER, "entry.ts"),
        formats: ["es"],
        fileName: "out",
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  return {
    js: outputs
      .filter((o) => o.type === "chunk")
      .map((o) => (o as { code: string }).code)
      .join("\n"),
    css: outputs
      .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
      .map((o) => String((o as { source: unknown }).source))
      .join("\n"),
  };
}

beforeAll(async () => {
  await buildLibraryIntoConsumer();
});

afterAll(() => {
  fs.rmSync(path.join(CONSUMER, "node_modules"), {
    recursive: true,
    force: true,
  });
});

describe("コンポーネントライブラリのプリコンパイル配布", () => {
  it("ライブラリとアプリの同一スタイルは 1 ルールに収束する（内容ハッシュの合流）", async () => {
    const { css } = await buildConsumer();

    expect(css.match(/gap:\s*9px/g)).toHaveLength(1);
  });

  it("ライブラリ固有のスタイルも配信 CSS に含まれる", async () => {
    const { css } = await buildConsumer();

    expect(css).toContain("border-radius:7px");
  });

  it("ライブラリ由来のクラス名も利用側ビルドで短縮され、JS と CSS が一貫する", async () => {
    const { js, css } = await buildConsumer();

    // 短縮後は bc プレフィックスのクラスが残らない
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
    expect(js).not.toMatch(/\bbc[a-z0-9]+\b/);
    // CSS の全セレクタが JS 側の文字列にも存在する（宙に浮いた定義がない）
    for (const selector of css.matchAll(/\.([a-z]\w*)\{/g)) {
      expect(js).toContain(`"${selector[1]}"`);
    }
  });
});
