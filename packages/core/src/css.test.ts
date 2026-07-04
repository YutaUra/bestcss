import { describe, expect, it } from "vitest";
import { css } from "./css.js";

describe("css タグ（ランタイムスタブ）", () => {
  it("実行時に呼ばれたらプラグイン未設定として分かるエラーを投げる", () => {
    // ビルド時変換が動いていれば css`` はコードから消えているはずなので、
    // 実行されること自体が設定ミスのシグナルである
    expect(() => css`color: red;`).toThrow("@best-css/vite-plugin");
  });
});
