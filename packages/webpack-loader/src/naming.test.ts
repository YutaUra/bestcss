import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";
import { afterEach, describe, expect, it } from "vitest";
import type { BestCssLoaderOptions } from "./index.js";
import { BestCssWebpackPlugin } from "./plugin.js";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "__fixtures__");
const LOADER = path.resolve(import.meta.dirname, "../dist/index.js");

let outDir: string | undefined;

afterEach(() => {
  if (outDir !== undefined) {
    fs.rmSync(outDir, { recursive: true, force: true });
    outDir = undefined;
  }
});

async function buildWithNaming(
  loaderOptions: BestCssLoaderOptions,
  pluginOptions: { classNamePrefixes?: string[] } = {},
): Promise<{ js: string; css: string }> {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "bestcss-wp-naming-"));
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
          use: [{ loader: LOADER, options: loaderOptions }],
        },
        {
          test: /\.css$/,
          sideEffects: true,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: "out.css" }),
      // プラグインは webpack を import しない構造型のため、型上は
      // WebpackPluginInstance と一致しない（実行時互換）
      new BestCssWebpackPlugin(
        pluginOptions,
      ) as unknown as webpack.WebpackPluginInstance,
    ],
  });
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (stats?.hasErrors())
        return reject(new Error(stats.toString({ errors: true })));
      compiler.close(() => resolve());
    });
  });
  const read = (name: string): string =>
    fs.readFileSync(path.join(outDir as string, name), "utf8");
  return { js: read("out.js"), css: read("out.css") };
}

describe("webpack loader: naming オプション", () => {
  it("関数を含む命名戦略を loader options 経由で渡せる", async () => {
    // Arrange / Act: webpack の loader options に関数を載せられることの確認も兼ねる
    const { css } = await buildWithNaming({
      naming: { className: ({ defaultName }) => `app-${defaultName}` },
    });

    // Assert
    expect(css).toMatch(/\.app-bc[0-9a-z]{7}/);
  });

  it("接頭辞をプラグインに宣言すれば、注入した名前でも短縮が効く", async () => {
    const { js, css } = await buildWithNaming(
      {
        naming: {
          className: ({ defaultName }) => `app-${defaultName}`,
          classNamePrefixes: ["app-"],
        },
      },
      { classNamePrefixes: ["app-"] },
    );

    expect(css).not.toContain("app-bc");
    expect(js).not.toContain("app-bc");
    expect(css).toMatch(/\.[a-z]\s*\{/);
  });

  it("接頭辞を宣言しないと短縮対象を収穫できない（bc 接頭辞が前提）", async () => {
    const { css } = await buildWithNaming({
      naming: { className: ({ defaultName }) => `app-${defaultName}` },
    });

    expect(css).toMatch(/\.app-bc[0-9a-z]{7}/);
  });
});
