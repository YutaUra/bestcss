import { describe, expect, it } from "vitest";
import { resolveNaming, type NamingStrategy } from "./naming.js";

const FILENAME = "src/Button.tsx";

describe("resolveNaming", () => {
  describe("既定の戦略", () => {
    it("クラス名は bc 接頭辞 + 内容ハッシュになる", () => {
      const naming = resolveNaming();

      expect(naming.className("color: red;", FILENAME)).toMatch(
        /^bc[0-9a-z]{7}$/,
      );
    });

    it("@keyframes 名は bk 接頭辞 + 内容ハッシュになる", () => {
      const naming = resolveNaming();

      expect(naming.keyframesName("fade", "0%{opacity:0}", FILENAME)).toMatch(
        /^bk[0-9a-z]{7}$/,
      );
    });

    it("書式だけが違う CSS は同一のクラス名に収束する", () => {
      const naming = resolveNaming();

      expect(naming.className("\n  color: red;\n", FILENAME)).toBe(
        naming.className("color:red", FILENAME),
      );
    });

    it("ファイルが違っても同一内容なら同一のクラス名になる", () => {
      const naming = resolveNaming();

      expect(naming.className("color: red;", "src/A.tsx")).toBe(
        naming.className("color: red;", "src/B.tsx"),
      );
    });
  });

  describe("hash の注入", () => {
    it("クラス名と @keyframes 名の両方のハッシュ部分に効く", () => {
      const naming = resolveNaming({ hash: () => "fixed" });

      expect(naming.className("color: red;", FILENAME)).toBe("bcfixed");
      expect(naming.keyframesName("fade", "0%{opacity:0}", FILENAME)).toBe(
        "bkfixed",
      );
    });

    it("ハッシュ関数には正規化済みの CSS が渡る", () => {
      const seen: string[] = [];
      const naming = resolveNaming({
        hash: (text) => {
          seen.push(text);
          return "x";
        },
      });

      naming.className("\n  color: red;\n", FILENAME);

      expect(seen).toEqual(["color:red"]);
    });
  });

  describe("className の注入", () => {
    it("返した名前がそのまま使われる", () => {
      const naming = resolveNaming({ className: () => "myClass" });

      expect(naming.className("color: red;", FILENAME)).toBe("myClass");
    });

    it("生 CSS・正規化済み CSS・ファイル名・既定名を受け取る", () => {
      const inputs: Parameters<NonNullable<NamingStrategy["className"]>>[0][] =
        [];
      const naming = resolveNaming({
        className: (input) => {
          inputs.push(input);
          return "myClass";
        },
      });

      naming.className("\n  color: red;\n", FILENAME);

      expect(inputs).toHaveLength(1);
      expect(inputs[0]).toEqual({
        css: "\n  color: red;\n",
        normalizedCss: "color:red",
        filename: FILENAME,
        defaultName: resolveNaming().className("color: red;", FILENAME),
      });
    });

    it("既定名を包んだ名前（接頭辞の付け替え）を返せる", () => {
      const naming = resolveNaming({
        className: ({ defaultName }) => `app-${defaultName}`,
      });

      expect(naming.className("color: red;", FILENAME)).toMatch(
        /^app-bc[0-9a-z]{7}$/,
      );
    });

    it("@keyframes 名には影響しない", () => {
      const naming = resolveNaming({ className: () => "myClass" });

      expect(naming.keyframesName("fade", "0%{opacity:0}", FILENAME)).toMatch(
        /^bk[0-9a-z]{7}$/,
      );
    });
  });

  describe("keyframesName の注入", () => {
    it("ユーザーが書いた元の名前も受け取る", () => {
      const naming = resolveNaming({
        keyframesName: ({ originalName, defaultName }) =>
          `${originalName}-${defaultName}`,
      });

      expect(naming.keyframesName("fade", "0%{opacity:0}", FILENAME)).toMatch(
        /^fade-bk[0-9a-z]{7}$/,
      );
    });
  });

  describe("注入された名前の検証", () => {
    it("数字始まりの名前はファイル名を含むエラーで拒否する", () => {
      const naming = resolveNaming({ className: () => "1bad" });

      expect(() => naming.className("color: red;", FILENAME)).toThrow(
        /src\/Button\.tsx/,
      );
    });

    it("空白を含む名前は拒否する（class 属性で 2 クラスに割れるため）", () => {
      const naming = resolveNaming({ className: () => "a b" });

      expect(() => naming.className("color: red;", FILENAME)).toThrow();
    });

    it("空文字列は拒否する", () => {
      const naming = resolveNaming({ className: () => "" });

      expect(() => naming.className("color: red;", FILENAME)).toThrow();
    });

    it("@keyframes 名も同じ規則で検証する", () => {
      const naming = resolveNaming({ keyframesName: () => "1bad" });

      expect(() =>
        naming.keyframesName("fade", "0%{opacity:0}", FILENAME),
      ).toThrow(/src\/Button\.tsx/);
    });
  });
});
