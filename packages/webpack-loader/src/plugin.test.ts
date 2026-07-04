import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";
import { afterEach, describe, expect, it } from "vitest";
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

async function buildWithPlugin(entryContent: string): Promise<{
  js: string;
  css: string;
}> {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "bestcss-wp-plugin-"));
  const entryFile = path.join(outDir, "entry.js");
  fs.writeFileSync(entryFile, entryContent);

  const compiler = webpack({
    mode: "production",
    context: FIXTURE_DIR,
    entry: entryFile,
    output: { path: outDir, filename: "out.js" },
    resolve: { modules: [path.join(FIXTURE_DIR, "../../node_modules")] },
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
    plugins: [
      new MiniCssExtractPlugin({ filename: "out.css" }),
      // プラグインは webpack を import しない構造型のため、型上は
      // WebpackPluginInstance と一致しない（実行時互換）
      new BestCssWebpackPlugin() as unknown as webpack.WebpackPluginInstance,
    ],
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

describe("BestCssWebpackPlugin", () => {
  it("クラス名が頻度順の短い名前に短縮され、JS と CSS で一致する", async () => {
    const { js, css } = await buildWithPlugin(
      `import { button } from "${path
        .join(FIXTURE_DIR, "styled.js")
        .replaceAll("\\", "/")}";\nconsole.log(button);\n`,
    );

    expect(js).not.toMatch(/\bbc[a-z0-9]+\b/);
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
    const className = js.match(/"([a-z][a-z0-9]*)"/)?.[1];
    expect(className).toBeDefined();
    expect(css).toContain(`.${className}`);
  });

  it("同一内容の css`` が複数ファイルにあっても CSS は 1 ルールに重複排除される", async () => {
    const styledA = path.join(FIXTURE_DIR, "styled.js").replaceAll("\\", "/");
    const styledB = path
      .join(FIXTURE_DIR, "styled-dup.js")
      .replaceAll("\\", "/");
    const { css } = await buildWithPlugin(
      `import { button } from "${styledA}";\nimport { button2 } from "${styledB}";\nconsole.log(button, button2);\n`,
    );

    expect(css.match(/44px/g)).toHaveLength(1);
  });
});
