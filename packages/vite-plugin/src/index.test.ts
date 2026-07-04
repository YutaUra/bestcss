import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

describe("bestCss プラグイン", () => {
  it("Vite が識別できるプラグイン名 best-css を持つ", () => {
    // Arrange & Act
    const plugin = bestCss();

    // Assert
    expect(plugin.name).toBe("best-css");
  });
});
