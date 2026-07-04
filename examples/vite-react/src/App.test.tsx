import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("css`` を含むコンポーネントをプラグイン設定済みの Vitest でテストできる", () => {
    // Arrange & Act
    const html = renderToStaticMarkup(<App />);

    // Assert: css`` がクラス名に変換されて描画されている
    expect(html).toContain('class="bc');
  });
});
