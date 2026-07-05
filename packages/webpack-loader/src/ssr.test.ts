import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";
import { afterEach, describe, expect, it } from "vitest";
import { BestCssWebpackPlugin } from "./plugin.js";

const LOADER = path.resolve(import.meta.dirname, "../dist/index.js");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
// loader を名前でなく絶対パスで参照する（tmp プロジェクトからは名前解決できない）
// pnpm では css-loader は webpack-loader パッケージ配下に配置される
const CSS_LOADER = path.join(
  REPO_ROOT,
  "packages/webpack-loader/node_modules/css-loader",
);

const SOURCE = [
  `import { css } from "@bestcss/core";`,
  `export const box = css\`padding: 41px;\`;`,
].join("\n");

let projectDir: string | undefined;

afterEach(() => {
  if (projectDir !== undefined) {
    fs.rmSync(projectDir, { recursive: true, force: true });
    projectDir = undefined;
  }
});

/**
 * 実インストール相当の tmp プロジェクトを作る。
 * "@bestcss/core" や matchResource 内の "@bestcss/webpack-loader/css" は
 * プロジェクトの node_modules 連鎖で解決されるため、symlink で用意する
 */
const setupProject = (): string => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "bestcss-ssr-"));
  fs.writeFileSync(path.join(projectDir, "entry.js"), SOURCE);
  const scope = path.join(projectDir, "node_modules/@bestcss");
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(
    path.join(REPO_ROOT, "packages/core"),
    path.join(scope, "core"),
  );
  fs.symlinkSync(
    path.join(REPO_ROOT, "packages/webpack-loader"),
    path.join(scope, "webpack-loader"),
  );
  return projectDir;
};

const run = (config: webpack.Configuration): Promise<void> =>
  new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (stats?.hasErrors())
        return reject(new Error(stats.toString({ errors: true })));
      compiler.close(() => resolve());
    });
  });

async function buildClient(dir: string): Promise<{ js: string; css: string }> {
  await run({
    mode: "production",
    context: dir,
    entry: path.join(dir, "entry.js"),
    output: { path: path.join(dir, "dist-client"), filename: "out.js" },
    module: {
      rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: [LOADER] },
        {
          test: /\.css$/,
          sideEffects: true,
          use: [MiniCssExtractPlugin.loader, CSS_LOADER],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: "out.css" }),
      new BestCssWebpackPlugin({
        ssr: true,
      }) as unknown as webpack.WebpackPluginInstance,
    ],
  });
  return {
    js: fs.readFileSync(path.join(dir, "dist-client/out.js"), "utf8"),
    css: fs.readFileSync(path.join(dir, "dist-client/out.css"), "utf8"),
  };
}

async function buildServer(dir: string): Promise<string> {
  await run({
    mode: "production",
    target: "node",
    context: dir,
    entry: path.join(dir, "entry.js"),
    output: {
      path: path.join(dir, "dist-server"),
      filename: "out.cjs",
      // SSR バンドルは renderer から require されるため exports を保持する
      library: { type: "commonjs2" },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          // サーバービルドは CSS を配信しないため import を発行しない
          use: [{ loader: LOADER, options: { emitCss: false } }],
        },
      ],
    },
    plugins: [
      new BestCssWebpackPlugin({
        ssr: true,
      }) as unknown as webpack.WebpackPluginInstance,
    ],
  });
  return fs.readFileSync(path.join(dir, "dist-server/out.cjs"), "utf8");
}

describe("webpack の SSR: リネーム表の共有 (client → server)", () => {
  it("クライアントビルドがリネーム表を node_modules/.bestcss に書き出す", async () => {
    const dir = setupProject();

    await buildClient(dir);

    const mapPath = path.join(dir, "node_modules/.bestcss/rename-map.json");
    expect(fs.existsSync(mapPath)).toBe(true);
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as Record<
      string,
      string
    >;
    expect(Object.keys(map)[0]).toMatch(/^bc/);
  });

  it("サーバービルドは共有された表で書き換え、クライアント CSS と一致する", async () => {
    const dir = setupProject();

    const { css } = await buildClient(dir);
    const serverJs = await buildServer(dir);

    const selector = /\.([a-z]\w*)\s*\{\s*padding:\s*41px/.exec(css)?.[1];
    expect(selector).toBeDefined();
    expect(serverJs).toContain(`"${selector}"`);
    expect(serverJs).not.toMatch(/\bbc[a-z0-9]+\b/);
  });

  it("emitCss: false のサーバービルドは CSS import を発行しない", async () => {
    const dir = setupProject();

    await buildClient(dir);
    const serverJs = await buildServer(dir);

    expect(serverJs).not.toContain("bestcss.css");
  });

  it("表がない状態でサーバービルドするとエラーになる（client が先という契約）", async () => {
    const dir = setupProject();

    await expect(buildServer(dir)).rejects.toThrow(/クライアントビルド/);
  });
});
