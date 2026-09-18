import { describe, expect, it } from "vitest";
import {
  applyRename,
  createGeneratedSelectorPattern,
  createRenameMap,
} from "./class-rename.js";

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

  it("bc 接頭辞でない名前（命名戦略を注入した場合）も置換する", () => {
    const custom = new Map([
      ["app-hero", "a"],
      ["app_card", "b"],
    ]);
    const js = 'const x = "app-hero app_card";';

    expect(applyRename(js, custom)).toBe('const x = "a b";');
  });

  it("名前の一部が別の名前の前方一致でも取り違えない", () => {
    const overlapping = new Map([
      ["app-hero", "a"],
      ["app-hero-lg", "b"],
    ]);

    expect(applyRename(".app-hero-lg{color:red}", overlapping)).toBe(
      ".b{color:red}",
    );
  });

  it("空のリネーム表では何も置換しない", () => {
    const js = 'const x = "bcaaa";';

    expect(applyRename(js, new Map())).toBe(js);
  });
});

describe("createGeneratedSelectorPattern", () => {
  /** CSS から収穫できたクラス名の一覧 */
  const harvest = (css: string, prefixes: string[]): string[] =>
    [...css.matchAll(createGeneratedSelectorPattern(prefixes))].map(
      (m) => m[1] as string,
    );

  it("既定の接頭辞で生成クラス名をセレクタから収穫する", () => {
    const css = ".bcaaa{color:red}.bcbbb:hover{opacity:.8}";

    expect(harvest(css, ["bc"])).toEqual(["bcaaa", "bcbbb"]);
  });

  it("接頭辞を持たない手書きのグローバルクラスは収穫しない", () => {
    const css = ".container{margin:0}.bcaaa{color:red}";

    expect(harvest(css, ["bc"])).toEqual(["bcaaa"]);
  });

  it("接頭辞で始まる手書きクラスは収穫しない（生成名のハッシュ部は base36 のみ）", () => {
    const css = ".bc-container{margin:0}.bcaaa{color:red}";

    expect(harvest(css, ["bc"])).toEqual(["bcaaa"]);
  });

  it("注入した命名の接頭辞を宣言すればその名前を収穫する", () => {
    const css = ".app-bcaaa{color:red}";

    expect(harvest(css, ["app-"])).toEqual(["app-bcaaa"]);
  });

  it("複数の接頭辞を宣言できる", () => {
    const css = ".app-a{color:red}.lib-b{color:blue}";

    expect(harvest(css, ["app-", "lib-"])).toEqual(["app-a", "lib-b"]);
  });
});
