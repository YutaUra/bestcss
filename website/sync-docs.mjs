// パッケージ同梱ドキュメント（日本語の正典）をサイトへ同期する。
// サイト側に日本語コンテンツを二重管理しないための仕組み。
// クロスパッケージの相対リンク（../../core/docs/...）はサイト内パスに書き換える
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// パッケージ docs ディレクトリ → サイトのセクションパス
const SECTIONS = [
  ["packages/core/docs", "core"],
  ["packages/vite-plugin/docs", "vite"],
  ["packages/webpack-loader/docs", "webpack"],
];

/** ../../<pkg>/docs/xxx.md 形式のリンクをサイト内パスへ書き換える */
function rewriteLinks(markdown) {
  return markdown
    .replaceAll(/\]\(\.\.\/\.\.\/core\/docs\/([\w.-]+)\.md\)/g, "](/core/$1)")
    .replaceAll(
      /\]\(\.\.\/\.\.\/vite-plugin\/docs\/([\w.-]+)\.md\)/g,
      "](/vite/$1)",
    )
    .replaceAll(
      /\]\(\.\.\/\.\.\/webpack-loader\/docs\/([\w.-]+)\.md\)/g,
      "](/webpack/$1)",
    );
}

for (const [sourceDir, section] of SECTIONS) {
  const source = path.join(repoRoot, sourceDir);
  const dest = path.join(here, "docs", section);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(source)) {
    if (!file.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(source, file), "utf8");
    fs.writeFileSync(path.join(dest, file), rewriteLinks(content));
  }
}
console.log("synced: packages/*/docs → website/docs/{core,vite,webpack}");
