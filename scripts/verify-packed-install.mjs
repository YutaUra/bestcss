// pack → 別プロジェクトへ install した状態で、同梱物（dist / docs）と
// docs のクロスパッケージ相対リンク（../../core/docs/...）が解決できることを
// 検証するスモークテスト。CI から実行する（事前に pnpm build が必要）
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packages = ["core", "vite-plugin", "webpack-loader"];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bestcss-pack-"));

try {
  const tarballs = packages.map((pkg) => {
    const out = path.join(tmp, `${pkg}.tgz`);
    execFileSync("pnpm", ["pack", "--out", out], {
      cwd: path.join(repoRoot, "packages", pkg),
      stdio: "pipe",
    });
    return out;
  });

  const proj = path.join(tmp, "proj");
  fs.mkdirSync(proj);
  fs.writeFileSync(
    path.join(proj, "package.json"),
    JSON.stringify({ name: "packed-install-check", private: true }),
  );
  execFileSync(
    "npm",
    ["install", ...tarballs, "--no-audit", "--no-fund"],
    { cwd: proj, stdio: "pipe" },
  );

  const failures = [];
  const inProj = (...p) => path.join(proj, "node_modules/@bestcss", ...p);

  for (const pkg of packages) {
    if (!fs.existsSync(inProj(pkg, "docs/index.md"))) {
      failures.push(`docs の同梱漏れ: ${pkg}`);
    }
    if (!fs.existsSync(inProj(pkg, "dist"))) {
      failures.push(`dist の同梱漏れ: ${pkg}（build 済みか確認）`);
    }
  }

  // docs 内の全相対リンクを、インストール後のレイアウトで検証する
  for (const pkg of packages) {
    const docsDir = inProj(pkg, "docs");
    if (!fs.existsSync(docsDir)) continue;
    for (const file of fs.readdirSync(docsDir)) {
      const content = fs.readFileSync(path.join(docsDir, file), "utf8");
      for (const m of content.matchAll(/\]\((\.[\w./-]*\.md)\)/g)) {
        const link = m[1];
        // 物理解決（fs が symlink を辿って .. を解決）と
        // 字句解決（path.resolve で .. を潰す）の両方を確認する
        if (!fs.existsSync(path.join(docsDir, link))) {
          failures.push(`物理解決 NG: ${pkg}/docs/${file} → ${link}`);
        }
        if (!fs.existsSync(path.resolve(docsDir, link))) {
          failures.push(`字句解決 NG: ${pkg}/docs/${file} → ${link}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`NG (${failures.length} 件):\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log(
    "OK: pack → install 後の dist / docs 同梱とリンク解決を確認した",
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
