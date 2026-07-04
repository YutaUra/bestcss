import { describe, expect, it } from "vitest";
import { matchRouteCss } from "./route-css-match.js";

const MANIFEST = {
  _renderer: ["static/renderer.css"],
  index: ["static/index.css", "static/shared.css"],
  about: ["static/shared.css"],
  "admin/index": ["static/admin.css", "static/shared.css"],
};

describe("matchRouteCss", () => {
  it("ルート / は index にマッチする", () => {
    const files = matchRouteCss(MANIFEST, "/");

    expect(files).toContain("static/index.css");
    expect(files).not.toContain("static/admin.css");
  });

  it("ネストしたパスは dir/index にもマッチする", () => {
    const files = matchRouteCss(MANIFEST, "/admin");

    expect(files).toContain("static/admin.css");
    expect(files).not.toContain("static/index.css");
  });

  it("_ 始まりのキー（_renderer 等）は全ページに含まれる", () => {
    expect(matchRouteCss(MANIFEST, "/about")).toContain("static/renderer.css");
    expect(matchRouteCss(MANIFEST, "/")).toContain("static/renderer.css");
  });

  it("重複する CSS ファイルは 1 回だけ返す", () => {
    const files = matchRouteCss(MANIFEST, "/admin");

    expect(files.filter((f) => f === "static/shared.css")).toHaveLength(1);
  });

  it("末尾スラッシュの揺れを吸収する", () => {
    expect(matchRouteCss(MANIFEST, "/admin/")).toContain("static/admin.css");
  });
});
