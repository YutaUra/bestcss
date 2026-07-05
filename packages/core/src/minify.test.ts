import { describe, expect, it } from "vitest";
import { minifyCss } from "./minify.js";

describe("minifyCss", () => {
  it("空白と改行を除去して最小化する", () => {
    const css = ".a {\n  color: red;\n  padding: 8px;\n}\n";

    expect(minifyCss(css)).toBe(".a{color:red;padding:8px}");
  });

  it("ネスト済みでない通常のルールを壊さない", () => {
    const css = ".a{color:red}.b:hover{opacity:.8}";

    const result = minifyCss(css);

    expect(result).toContain(".a{color:red}");
    expect(result).toContain(".b:hover{opacity:.8}");
  });
});
