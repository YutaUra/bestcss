import { describe, expect, it } from "vitest";
import { transform } from "./transform.js";

const FILENAME = "src/Button.tsx";

/** 変換後コードから注入されたクラス名を取り出すテスト用ヘルパー */
const extractClassName = (code: string, variable: string): string => {
  const match = code.match(new RegExp(`const ${variable} = "([^"]+)"`));
  if (!match?.[1]) {
    throw new Error(`クラス名リテラルが見つかりません: ${code}`);
  }
  return match[1];
};

describe("transform", () => {
  it("css タグを含まないコードは変換不要として null を返す", () => {
    const code = `export const x = 1;`;

    const result = transform(code, { filename: FILENAME });

    expect(result).toBeNull();
  });

  it("css`` をクラス名の文字列リテラルに置換し、CSS を抽出する", () => {
    // Arrange
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`padding: 8px 16px;\`;`,
    ].join("\n");

    // Act
    const result = transform(code, { filename: FILENAME });

    // Assert
    expect(result).not.toBeNull();
    const className = extractClassName(result!.code, "button");
    expect(result!.code).not.toContain("css`");
    expect(result!.css).toContain(`.${className}`);
    expect(result!.css).toContain("padding: 8px 16px;");
  });

  it("変換後のコードから @best-css/core の import を除去する（ゼロランタイム）", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`color: red;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.code).not.toContain("@best-css/core");
  });

  it("エイリアス import（css as styled）でも変換する", () => {
    const code = [
      `import { css as style } from "@best-css/core";`,
      `const button = style\`color: red;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result).not.toBeNull();
    expect(result!.code).not.toContain("style`");
  });

  it("${} 補間はファイル名を含むエラーで拒否する", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      "const button = css`color: ${dynamic};`;",
    ].join("\n");

    expect(() => transform(code, { filename: FILENAME })).toThrow(FILENAME);
  });

  it("別モジュール由来の css 関数は変換しない", () => {
    const code = [
      `import { css } from "other-library";`,
      `const button = css\`color: red;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result).toBeNull();
  });

  it("複数の css`` をそれぞれ独立したクラスとして抽出する", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`color: red;\`;`,
      `const b = css\`color: blue;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    const classA = extractClassName(result!.code, "a");
    const classB = extractClassName(result!.code, "b");
    expect(classA).not.toBe(classB);
    expect(result!.css).toContain(`.${classA}`);
    expect(result!.css).toContain(`.${classB}`);
  });

  it("生成したクラス名の一覧を返す", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`color: red;\`;`,
      `const b = css\`color: blue;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    const classA = extractClassName(result!.code, "a");
    const classB = extractClassName(result!.code, "b");
    expect(result!.classNames).toEqual([classA, classB]);
  });

  it("ネスト（&:hover）を含む CSS を処理できる", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`
        color: red;
        &:hover {
          color: blue;
        }
      \`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css).toContain(":hover");
  });

  it("不正な CSS はファイル名を含むエラーで拒否する", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`color: {{{;\`;`,
    ].join("\n");

    expect(() => transform(code, { filename: FILENAME })).toThrow(FILENAME);
  });
});
