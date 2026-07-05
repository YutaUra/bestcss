import { describe, expect, it } from "vitest";
import { dedupeCss } from "./dedupe.js";

describe("dedupeCss", () => {
  it("同一ルールの重複を 1 つにする", () => {
    const css = ".bca {color: red;}\n.bca {color: red;}";

    const result = dedupeCss(css);

    expect(result.match(/\.bca/g)).toHaveLength(1);
  });

  it("内容が異なるルールはすべて保持する", () => {
    const css = ".bca {color: red;}\n.bcb {color: blue;}";

    const result = dedupeCss(css);

    expect(result).toContain(".bca");
    expect(result).toContain(".bcb");
  });

  it("重複のうち最後の出現位置を保持する（カスケードを変えない）", () => {
    // 複数クラスを併用した要素では後方のルールが勝つため、
    // 先頭側を残すと .bcb との勝敗が入れ替わってしまう
    const css = ".bca {color: red;}\n.bcb {color: blue;}\n.bca {color: red;}";

    const result = dedupeCss(css);

    expect(result.match(/\.bca/g)).toHaveLength(1);
    expect(result.indexOf(".bcb")).toBeLessThan(result.indexOf(".bca"));
  });

  it("@media はブロック全体を 1 単位として重複判定する", () => {
    const inMedia = "@media (width >= 600px) {\n.bca {color: red;}\n}";
    const css = `${inMedia}\n${inMedia}`;

    const result = dedupeCss(css);

    expect(result.match(/@media/g)).toHaveLength(1);
  });

  it("メディアクエリが異なれば中身が同じでも両方保持する", () => {
    const css = [
      "@media (width >= 600px) {\n.bca {color: red;}\n}",
      "@media (width >= 900px) {\n.bca {color: red;}\n}",
    ].join("\n");

    const result = dedupeCss(css);

    expect(result.match(/@media/g)).toHaveLength(2);
  });

  it("トップレベルのルールと @media 内の同一ルールを混同しない", () => {
    const css = [
      ".bca {color: red;}",
      "@media (width >= 600px) {\n.bca {color: red;}\n}",
    ].join("\n");

    const result = dedupeCss(css);

    expect(result.match(/\.bca/g)).toHaveLength(2);
  });

  it("文字列値に含まれる波括弧で構造を壊さない", () => {
    const css = '.bca {content: "{";}\n.bcb {color: blue;}';

    const result = dedupeCss(css);

    expect(result).toContain('content: "{"');
    expect(result).toContain(".bcb");
  });

  it("minify 済みの CSS（改行なし）でも重複排除できる", () => {
    const css = ".bca{color:red}.bcb{color:blue}.bca{color:red}";

    const result = dedupeCss(css);

    expect(result.match(/\.bca/g)).toHaveLength(1);
    expect(result).toContain(".bcb");
  });

  it("@layer の順序宣言は最初の出現を残す（先頭で順序を確定させる）", () => {
    const css = [
      "@layer base, components;",
      "@layer components {\n.bca {color: red;}\n}",
      "@layer base, components;",
    ].join("\n");

    const result = dedupeCss(css);

    expect(result.match(/@layer base, components;/g)).toHaveLength(1);
    expect(result.trimStart().startsWith("@layer base, components;")).toBe(true);
  });
});
