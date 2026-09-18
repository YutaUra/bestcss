import { describe, expect, it } from "vitest";
import { createCss, css } from "./testing.js";
import { transform } from "./transform.js";

/** 同じブロックを本番の変換に通したときのクラス名を得る */
const productionClassName = (block: string): string => {
  const code = [
    `import { css } from "@bestcss/core";`,
    `export const a = css\`${block}\`;`,
  ].join("\n");
  const result = transform(code, { filename: "parity.tsx" });
  return result?.classNames[0] ?? "";
};

describe("テスト実行環境向けの css``（@bestcss/core/testing）", () => {
  it("実行時に例外を投げず、クラス名文字列を返す", () => {
    const name = css`padding: 16px;`;

    expect(name).toMatch(/^bc[a-z0-9]+$/);
  });

  it("本番ビルドの変換と同じクラス名を返す（スナップショットの互換）", () => {
    const block = "padding: 16px; &:hover { opacity: 0.8; }";

    expect(css`padding: 16px; &:hover { opacity: 0.8; }`).toBe(
      productionClassName(block),
    );
  });

  it("同一ブロック内の @keyframes を含む場合も本番と同じクラス名になる", () => {
    const block =
      "animation: pulse 2s infinite; @keyframes pulse { 50% { opacity: 0.5; } }";

    expect(
      css`animation: pulse 2s infinite; @keyframes pulse { 50% { opacity: 0.5; } }`,
    ).toBe(productionClassName(block));
  });

  it("${} 補間は本番同様にエラーになる", () => {
    const color = "red";

    // @ts-expect-error 補間は型レベルでも拒否される（本番の css と同じ契約）
    expect(() => css`color: ${color};`).toThrow(/補間/);
  });

  it("createCss に命名戦略を渡すと本番の naming オプションと同じ名前になる", () => {
    // Arrange
    const naming = {
      className: ({ defaultName }: { defaultName: string }) =>
        `app-${defaultName}`,
    };
    const block = "padding: 16px;";
    const code = [
      `import { css } from "@bestcss/core";`,
      `export const a = css\`${block}\`;`,
    ].join("\n");

    // Act
    const testingName = createCss({ naming })`padding: 16px;`;

    // Assert
    expect(testingName).toBe(
      transform(code, { filename: "parity.tsx", naming })?.classNames[0],
    );
    expect(testingName).toMatch(/^app-bc[0-9a-z]{7}$/);
  });
});
