import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";
import { afterEach, describe, expect, it } from "vitest";
import type { BestCssLoaderOptions } from "./index.js";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");
const LOADER = path.resolve(import.meta.dirname, "../dist/index.js");

let outDir: string | undefined;

afterEach(() => {
  if (outDir !== undefined) {
    fs.rmSync(outDir, { recursive: true, force: true });
    outDir = undefined;
  }
});

async function buildCss(options: BestCssLoaderOptions): Promise<string> {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "bestcss-targets-"));
  const compiler = webpack({
    mode: "production",
    context: FIXTURE_DIR,
    entry: path.join(FIXTURE_DIR, "targets-entry.js"),
    output: { path: outDir, filename: "out.js" },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [{ loader: LOADER, options }],
        },
        {
          test: /\.css$/,
          sideEffects: true,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    plugins: [new MiniCssExtractPlugin({ filename: "out.css" })],
  });
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (stats?.hasErrors())
        return reject(new Error(stats.toString({ errors: true })));
      compiler.close(() => resolve());
    });
  });
  return fs.readFileSync(path.join(outDir, "out.css"), "utf8");
}

describe("webpack loader: targets オプション", () => {
  it("browserslist クエリを渡すとフラット化とプレフィックス付与が行われる", async () => {
    const cssText = await buildCss({ targets: "safari 15" });

    expect(cssText).toContain("-webkit-user-select");
    expect(cssText).not.toContain("&");
  });

  it("未指定ならダウンレベルしない（モダンブラウザ前提）", async () => {
    const cssText = await buildCss({});

    expect(cssText).toContain("&:hover");
    expect(cssText).not.toContain("-webkit-user-select");
  });
});
