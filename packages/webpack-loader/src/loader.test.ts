import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";
import { afterEach, describe, expect, it } from "vitest";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");
const LOADER = path.resolve(import.meta.dirname, "../dist/index.js");

let outDir: string | undefined;

afterEach(() => {
  if (outDir !== undefined) {
    fs.rmSync(outDir, { recursive: true, force: true });
    outDir = undefined;
  }
});

async function buildWithWebpack(): Promise<{ js: string; css: string }> {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "best-css-webpack-"));
  const compiler = webpack({
    mode: "production",
    context: FIXTURE_DIR,
    entry: path.join(FIXTURE_DIR, "entry.js"),
    output: { path: outDir, filename: "out.js" },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [LOADER],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    plugins: [new MiniCssExtractPlugin({ filename: "out.css" })],
  });

  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (stats?.hasErrors()) {
        reject(new Error(stats.toString({ errors: true })));
        return;
      }
      compiler.close(() => resolve());
    });
  });

  return {
    js: fs.readFileSync(path.join(outDir, "out.js"), "utf8"),
    css: fs.readFileSync(path.join(outDir, "out.css"), "utf8"),
  };
}

describe("@bestcss/webpack-loader", () => {
  it("webpack ビルドで css`` がクラス名に置換され、CSS が抽出される", async () => {
    const { js, css } = await buildWithWebpack();

    expect(js).not.toContain("css`");
    expect(js).toMatch(/"bc[a-z0-9]+"/);
    expect(css).toContain("44px");
    // クラス名が JS と CSS で一致する
    const className = js.match(/"(bc[a-z0-9]+)"/)?.[1];
    expect(css).toContain(`.${className}`);
  });

  it("出力 JS にランタイムコードが残らない（ゼロランタイム）", async () => {
    const { js } = await buildWithWebpack();

    expect(js).not.toContain("ビルド時に変換");
  });
});
