import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_DIR = path.join(PACKAGE_ROOT, "docs");

// AI エージェント向けの同梱ドキュメント（Next.js の
// node_modules/next/dist/docs/ と同じパターン）が publish に含まれ、
// インストールされたバージョンと自動で一致することを契約として固定する
describe("同梱ドキュメント (vite-plugin)", () => {
  it("package.json の files に docs が含まれる（publish から漏れない）", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { files: string[] };

    expect(pkg.files).toContain("docs");
  });

  it("docs/index.md（目次）が存在する", () => {
    expect(fs.existsSync(path.join(DOCS_DIR, "index.md"))).toBe(true);
  });

  it("docs 内の相対リンクがすべて解決できる", () => {
    const links: Array<[string, string]> = [];
    for (const file of fs.readdirSync(DOCS_DIR)) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), "utf8");
      for (const m of content.matchAll(/\]\((\.[\w./-]*\.md)\)/g)) {
        links.push([file, m[1] as string]);
      }
    }

    expect(links.length).toBeGreaterThan(0);
    for (const [from, link] of links) {
      expect(
        fs.existsSync(path.resolve(DOCS_DIR, link)),
        `${from} → ${link}`,
      ).toBe(true);
    }
  });
});
