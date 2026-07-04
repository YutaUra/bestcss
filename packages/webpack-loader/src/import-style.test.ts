import { describe, expect, it } from "vitest";
import bestCssLoader from "./index.js";

const SOURCE = [
  `import { css } from "@best-css/core";`,
  `export const a = css\`color: red;\`;`,
].join("\n");

function runLoader(options: Record<string, unknown>): string {
  let output = "";
  bestCssLoader.call(
    {
      resourcePath: "/proj/src/Button.tsx",
      getOptions: () => options,
      callback: (_err: Error | null, content?: string) => {
        output = content ?? "";
      },
    },
    SOURCE,
  );
  return output;
}

describe("パスの検証", () => {
  it("! や ? を含むパスは loader チェーン注入になり得るため拒否する", () => {
    expect(() =>
      bestCssLoader.call(
        {
          resourcePath: "/proj/evil!other-loader!/x.tsx",
          getOptions: () => ({}),
          callback: () => {},
        },
        SOURCE,
      ),
    ).toThrow(/パス/);
  });
});

describe("importStyle オプション", () => {
  it("デフォルト（match-resource）は !=! 構文で CSS を取り込む", () => {
    const output = runLoader({});

    expect(output).toContain(
      "/proj/src/Button.tsx.best-css.css!=!@best-css/webpack-loader/css!/proj/src/Button.tsx",
    );
  });

  it("query 指定時は自分自身をクエリ付きで import する（Turbopack 向け）", () => {
    // Turbopack は matchResource（!=!）を解釈しないため、
    // 実ファイル + クエリを rules（query 条件 + as: '*.css'）で CSS 化する
    const output = runLoader({ importStyle: "query" });

    expect(output).toContain(`import "./Button.tsx?best-css"`);
    expect(output).not.toContain("!=!");
  });
});
