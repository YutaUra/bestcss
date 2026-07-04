import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { bestCss } from "@bestcss/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { build } from "vite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const VARIANTS = [
  {
    name: "best-css",
    entry: "src/best-css/page.ts",
    plugins: () => [bestCss()],
  },
  {
    name: "css-modules",
    entry: "src/css-modules/page.ts",
    plugins: () => [],
  },
  {
    name: "tailwind",
    entry: "src/tailwind/page.ts",
    plugins: () => [tailwindcss()],
  },
];

const gzip = (text) => gzipSync(Buffer.from(text)).length;

/** class 属性そのものの重さ（スタイリング手法が HTML に課すコスト） */
const classAttrBytes = (html) => {
  let total = 0;
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    total += Buffer.byteLength(match[0]);
  }
  return total;
};

const results = [];
for (const variant of VARIANTS) {
  const outDir = path.join(ROOT, "dist", variant.name);
  await build({
    configFile: false,
    root: ROOT,
    logLevel: "warn",
    plugins: variant.plugins(),
    build: {
      outDir,
      emptyOutDir: true,
      lib: {
        entry: path.join(ROOT, variant.entry),
        formats: ["es"],
        fileName: "page",
      },
    },
  });

  const mod = await import(pathToFileURL(path.join(outDir, "page.js")));
  const html = mod.render();
  const css = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(path.join(outDir, f), "utf8"))
    .join("");

  results.push({
    name: variant.name,
    htmlBytes: Buffer.byteLength(html),
    htmlGzip: gzip(html),
    classBytes: classAttrBytes(html),
    cssBytes: Buffer.byteLength(css),
    cssGzip: gzip(css),
    totalGzip: gzip(html) + gzip(css),
  });
}

const fmt = (n) => n.toLocaleString("en-US");
const header = [
  "手法",
  "HTML",
  "HTML gz",
  "class属性",
  "CSS",
  "CSS gz",
  "合計 gz",
];
const rows = results.map((r) => [
  r.name,
  fmt(r.htmlBytes),
  fmt(r.htmlGzip),
  fmt(r.classBytes),
  fmt(r.cssBytes),
  fmt(r.cssGzip),
  fmt(r.totalGzip),
]);

const table = [
  `| ${header.join(" | ")} |`,
  `|${header.map(() => "---:").join("|")}|`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

console.log(table);

const date = process.argv[2] ?? "unknown-date";
const report = `# サイズベンチマーク結果

実行日: ${date}

同一の UI（ダッシュボード: ナビ + カード x12 + テーブル 20 行 + フォーム）を
3 手法で構築し、実際の Vite ビルドを通した出力を計測した。単位はバイト。

${table}

## 計測条件

- Vite lib ビルド（minify / cssMinify 有効）の出力 JS を実行して HTML を生成
- 「class属性」は HTML 中の \`class="..."\` の合計バイト数（手法が HTML に課すコスト）
- tailwind は preflight（リセット CSS）を除外し theme + utilities のみ
  （他手法もリセットを持たないため、手法自体の出力サイズだけを比較する）
- コーパス定義: [bench/src](src)
`;
fs.writeFileSync(path.join(ROOT, "RESULTS.md"), report);
console.log("\nbench/RESULTS.md に書き出しました");
