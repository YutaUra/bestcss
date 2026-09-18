import { describe, expect, it } from "vitest";
import { normalizeCssForHash } from "./normalize-css.js";

describe("normalizeCssForHash", () => {
  it("連続する空白・改行・タブを 1 個の空白に畳む", () => {
    // Arrange
    const css = "margin:\n\t 0   auto;";

    // Act
    const normalized = normalizeCssForHash(css);

    // Assert
    expect(normalized).toBe("margin:0 auto");
  });

  it("コメントを除去する", () => {
    expect(normalizeCssForHash("/* 余白 */padding:8px;/* 末尾 */")).toBe(
      "padding:8px",
    );
  });

  it("区切り記号（; , { }）の前後の空白を除去する", () => {
    const css = "&:hover , & > .b { color : red ; opacity : .5 }";

    expect(normalizeCssForHash(css)).toBe(
      "&:hover,& > .b{color :red;opacity :.5}",
    );
  });

  it("コロンの後ろの空白は除去するが前の空白は残す（子孫結合子を壊さない）", () => {
    // "& :hover"（子孫の hover）と "&:hover"（自身の hover）は別セレクタなので
    // 同一の正規化結果に畳んではならない
    const descendant = normalizeCssForHash("& :hover { color: red }");
    const self = normalizeCssForHash("&:hover { color: red }");

    expect(descendant).not.toBe(self);
    expect(descendant).toBe("& :hover{color:red}");
  });

  it("文字列リテラルの中身は空白もコメント風の文字列も保持する", () => {
    const css = `content: "a  b /* not a comment */";`;

    expect(normalizeCssForHash(css)).toBe(
      `content:"a  b /* not a comment */"`,
    );
  });

  it("calc() 内の演算子まわりの空白は保持する（意味が変わるため）", () => {
    const css = "width: calc(100% - 8px);";

    expect(normalizeCssForHash(css)).toBe("width:calc(100% - 8px)");
  });

  it("末尾のセミコロンと閉じ括弧直前のセミコロンを除去する", () => {
    expect(normalizeCssForHash("color: red;")).toBe("color:red");
    expect(normalizeCssForHash("&:hover { color: red; }")).toBe(
      "&:hover{color:red}",
    );
  });

  it("連続するセミコロンを 1 個に畳む", () => {
    expect(normalizeCssForHash("color: red;;opacity: .5;")).toBe(
      "color:red;opacity:.5",
    );
  });

  it("書式だけが異なる CSS は同一の正規化結果になる", () => {
    const compact = "padding:8px;color:red";
    const formatted = "\n  padding: 8px;\n  color: red;\n";
    const commented = "\n  /* 余白 */\n  padding: 8px;\n  color: red\n";

    expect(normalizeCssForHash(formatted)).toBe(
      normalizeCssForHash(compact),
    );
    expect(normalizeCssForHash(commented)).toBe(
      normalizeCssForHash(compact),
    );
  });

  it("意味が異なる CSS は異なる正規化結果になる", () => {
    expect(normalizeCssForHash("padding: 8px;")).not.toBe(
      normalizeCssForHash("padding: 16px;"),
    );
  });
});
