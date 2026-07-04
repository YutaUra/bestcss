import { describe, expect, it } from "vitest";
import { applyRename, createRenameMap } from "./class-rename.js";

describe("createRenameMap", () => {
  it("使用頻度が高いクラスほど短い（または同長の）名前を割り当てる", () => {
    // Arrange
    const frequencies = new Map([
      ["bcrare", 1],
      ["bccommon", 100],
      ["bcmedium", 10],
    ]);

    // Act
    const map = createRenameMap(frequencies);

    // Assert
    const common = map.get("bccommon")!;
    const medium = map.get("bcmedium")!;
    const rare = map.get("bcrare")!;
    expect(common.length).toBeLessThanOrEqual(medium.length);
    expect(medium.length).toBeLessThanOrEqual(rare.length);
  });

  it("全単射（新しい名前に重複がない）", () => {
    const frequencies = new Map(
      Array.from({ length: 100 }, (_, i) => [`bcname${i}`, i] as const),
    );

    const map = createRenameMap(frequencies);

    const renamed = new Set(map.values());
    expect(renamed.size).toBe(100);
  });

  it("すべての新しい名前が CSS クラス名として有効（英字始まり）", () => {
    const frequencies = new Map(
      Array.from({ length: 100 }, (_, i) => [`bcname${i}`, 1] as const),
    );

    const map = createRenameMap(frequencies);

    for (const name of map.values()) {
      expect(name).toMatch(/^[a-z][a-z0-9]*$/);
    }
  });

  it("同一頻度でも入力順に依らず決定的に割り当てる", () => {
    const a = createRenameMap(
      new Map([
        ["bcx", 5],
        ["bcy", 5],
      ]),
    );
    const b = createRenameMap(
      new Map([
        ["bcy", 5],
        ["bcx", 5],
      ]),
    );

    expect(a.get("bcx")).toBe(b.get("bcx"));
    expect(a.get("bcy")).toBe(b.get("bcy"));
  });
});

describe("applyRename", () => {
  const map = new Map([
    ["bcaaa", "a"],
    ["bcbbb", "b"],
  ]);

  it("CSS セレクタ内のクラス名を置換する", () => {
    const css = ".bcaaa{color:red}.bcbbb:hover{opacity:.8}";

    expect(applyRename(css, map)).toBe(".a{color:red}.b:hover{opacity:.8}");
  });

  it("JS の文字列リテラル内のクラス名を置換する", () => {
    const js = 'const x = "bcaaa"; const y = `bcaaa bcbbb`;';

    expect(applyRename(js, map)).toBe('const x = "a"; const y = `a b`;');
  });

  it("より長い識別子の一部は置換しない", () => {
    const js = 'const bcaaax = "bcaaax";';

    expect(applyRename(js, map)).toBe(js);
  });

  it("リネーム表にない bc 名は置換しない", () => {
    const js = 'const x = "bczzz";';

    expect(applyRename(js, map)).toBe(js);
  });
});
