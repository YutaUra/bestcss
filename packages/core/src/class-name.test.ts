import { describe, expect, it } from "vitest";
import { generateClassName } from "./class-name.js";

describe("generateClassName", () => {
  it("同一の CSS 内容からは常に同一のクラス名を生成する", () => {
    // Arrange
    const cssText = "padding: 8px 16px;";

    // Act
    const first = generateClassName(cssText);
    const second = generateClassName(cssText);

    // Assert
    expect(first).toBe(second);
  });

  it("異なる CSS 内容からは異なるクラス名を生成する", () => {
    const a = generateClassName("padding: 8px;");
    const b = generateClassName("padding: 16px;");

    expect(a).not.toBe(b);
  });

  it("CSS クラス名として有効な文字列を生成する（数字始まり等を許さない）", () => {
    const className = generateClassName("color: red;");

    expect(className).toMatch(/^[A-Za-z_][A-Za-z0-9_-]*$/);
  });

  it("HTML サイズを膨らませない長さに収まる", () => {
    const className = generateClassName("display: flex; gap: 4px;");

    expect(className.length).toBeLessThanOrEqual(16);
  });
});
