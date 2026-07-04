import { describe, expect, it } from "vitest";
import { collectImportSources } from "./imports.js";

describe("collectImportSources", () => {
  it("静的 import の指定子を列挙する", () => {
    const code = [
      `import { a } from "./a.js";`,
      `import b from "../b.js";`,
      `import "side-effect-pkg";`,
    ].join("\n");

    const sources = collectImportSources(code, "src/x.ts");

    expect(sources).toEqual(["./a.js", "../b.js", "side-effect-pkg"]);
  });

  it("再エクスポート（export from）の指定子も列挙する", () => {
    const code = [
      `export { a } from "./a.js";`,
      `export * from "./b.js";`,
    ].join("\n");

    const sources = collectImportSources(code, "src/x.ts");

    expect(sources).toEqual(["./a.js", "./b.js"]);
  });

  it("動的 import の文字列リテラル指定子も列挙する", () => {
    const code = `const mod = await import("./lazy.js");`;

    const sources = collectImportSources(code, "src/x.ts");

    expect(sources).toEqual(["./lazy.js"]);
  });

  it("JSX を含む tsx でも解析できる", () => {
    const code = [
      `import { Layout } from "./layout.js";`,
      `export const Page = () => <Layout>hello</Layout>;`,
    ].join("\n");

    const sources = collectImportSources(code, "src/page.tsx");

    expect(sources).toEqual(["./layout.js"]);
  });
});
