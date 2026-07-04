import { decode } from "@jridgewell/sourcemap-codec";
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

  it("@media を css`` 内にネストして書ける", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`color: red; @media (min-width: 600px) { color: blue; }\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css).toContain("@media");
    expect(result!.css).toContain("red");
  });

  it("@supports / @container も css`` 内にネストして書ける", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`display: grid; @supports (display: flex) { display: flex; }\`;`,
      `const b = css\`color: red; @container (min-width: 400px) { color: blue; }\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css).toContain("@supports");
    expect(result!.css).toContain("@container");
  });

  it("@keyframes はスコープ付きの名前でトップレベルに出力される", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`animation: spin 1s linear; @keyframes spin { to { transform: rotate(360deg); } }\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css).toMatch(/@keyframes bk[a-z0-9]+/);
    // 元のグローバル名は出力に残らない
    expect(result!.css).not.toMatch(/@keyframes spin/);
    // animation 参照もスコープ名に書き換わる
    // （Lightning CSS がショートハンドの語順を正規化するため語順には依存しない）
    expect(result!.css).toMatch(/animation:[^;]*bk[a-z0-9]+/);
  });

  it("同一ファイル内の別ブロックからも @keyframes を参照できる", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`@keyframes pulse { 50% { opacity: 0.5; } }\`;`,
      `const b = css\`animation-name: pulse;\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    const scoped = result!.css.match(/@keyframes (bk[a-z0-9]+)/)?.[1];
    expect(result!.css).toContain(`animation-name: ${scoped}`);
  });

  it("animation 系以外の宣言値は keyframes 名と一致しても書き換えない", () => {
    // keyframes 名の参照書き換えを animation / animation-name の値に
    // 限定しないと、"block" のような CSS キーワードと同名の keyframes が
    // 無関係な宣言を壊してしまう
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`display: block; animation-name: block; @keyframes block { to { opacity: 0; } }\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css).toContain("display: block");
    expect(result!.css).toMatch(/animation-name: bk[a-z0-9]+/);
  });

  it("同一内容の @keyframes は同一名に収束し 1 回だけ出力される", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const a = css\`animation-name: spinA; @keyframes spinA { to { opacity: 0; } }\`;`,
      `const b = css\`animation-name: spinB; @keyframes spinB { to { opacity: 0; } }\`;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.css.match(/@keyframes/g)).toHaveLength(1);
  });

  it("元ソースへのソースマップを返す", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`color: red;\`;`,
      `export const f = () => button;`,
    ].join("\n");

    const result = transform(code, { filename: FILENAME });

    expect(result!.map).toBeDefined();
    expect(result!.map.sources).toContain(FILENAME);
    expect(result!.map.mappings.length).toBeGreaterThan(0);
  });

  it("出力 CSS から css`` の元位置へのソースマップを返す", () => {
    // Arrange: css`` は 0-based で 2 行目にある
    const code = [
      `import { css } from "@best-css/core";`,
      `const other = 1;`,
      `const button = css\`color: red;\`;`,
    ].join("\n");

    // Act
    const result = transform(code, { filename: FILENAME });

    // Assert
    const cssMap = JSON.parse(result!.cssMap) as {
      sources: string[];
      sourcesContent: string[];
      mappings: string;
    };
    expect(cssMap.sources).toContain(FILENAME);
    // DevTools がソース本文を表示できるよう元コードを同梱する
    expect(cssMap.sourcesContent[0]).toContain("css`");
    // いずれかのセグメントが css`` のある行（0-based: 2）を指す
    const decoded = decode(cssMap.mappings);
    const originalLines = decoded.flat().map((segment) => segment[2]);
    expect(originalLines).toContain(2);
  });

  it("不正な CSS はファイル名を含むエラーで拒否する", () => {
    const code = [
      `import { css } from "@best-css/core";`,
      `const button = css\`color: {{{;\`;`,
    ].join("\n");

    expect(() => transform(code, { filename: FILENAME })).toThrow(FILENAME);
  });
});
