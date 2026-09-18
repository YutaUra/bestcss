import { describe, expect, it } from "vitest";
import {
  contentHash,
  generateClassName,
  generateKeyframesName,
} from "./class-name.js";

describe("contentHash", () => {
  it("同一の内容からは常に同一のハッシュを生成する", () => {
    expect(contentHash("padding: 8px;")).toBe(contentHash("padding: 8px;"));
  });

  it("内容によらず常に同じ長さになる（出力サイズの見積もりを安定させる）", () => {
    const lengths = new Set(
      ["a", "color: red;", "x".repeat(1000), "", "0"].map(
        (text) => contentHash(text).length,
      ),
    );

    expect(lengths).toEqual(new Set([7]));
  });

  it("英数字のみで構成される（CSS 識別子として安全）", () => {
    expect(contentHash("color: red;")).toMatch(/^[0-9a-z]+$/);
  });

  it("正規化は行わない（受け取った文字列そのものを対象にする）", () => {
    expect(contentHash("color:red")).not.toBe(contentHash("color: red"));
  });
});

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

  it("内容によらず常に同じ長さになる", () => {
    expect(generateClassName("color: red;")).toHaveLength(
      generateClassName("display: flex; gap: 4px; padding: 8px;").length,
    );
  });

  it("インデント・改行・コメントの差ではクラス名が変わらない", () => {
    const compact = generateClassName("padding:8px;color:red");
    const formatted = generateClassName("\n  padding: 8px;\n  color: red;\n");
    const commented = generateClassName(
      "\n  /* 余白 */\n  padding: 8px;\n  color: red;\n",
    );

    expect(formatted).toBe(compact);
    expect(commented).toBe(compact);
  });

  it("ハッシュ関数を差し替えられる", () => {
    expect(generateClassName("color: red;", () => "fixed")).toBe("bcfixed");
  });
});

describe("generateKeyframesName", () => {
  it("bk 接頭辞でクラス名と名前空間を分ける", () => {
    expect(generateKeyframesName("0%{opacity:0}")).toMatch(/^bk[0-9a-z]+$/);
  });

  it("書式だけが違う本体は同一名に収束する", () => {
    expect(generateKeyframesName("\n  0% { opacity: 0 }\n")).toBe(
      generateKeyframesName("0%{opacity:0}"),
    );
  });

  it("同一内容でもクラス名とは別の名前になる", () => {
    const body = "0%{opacity:0}";

    expect(generateKeyframesName(body)).not.toBe(generateClassName(body));
  });
});
