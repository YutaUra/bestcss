import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTargets } from "./targets.js";

const FIXTURE_WITH_CONFIG = path.resolve(
  import.meta.dirname,
  "__fixtures__/browserslist-config",
);

describe("resolveTargets: browserslist クエリの解決", () => {
  it("明示クエリを Lightning CSS の Targets へ変換する", () => {
    const targets = resolveTargets("safari 15", process.cwd());

    // Lightning CSS の Targets はバージョンを major << 16 で表す
    expect(targets).toEqual({ safari: 15 << 16 });
  });

  it("クエリ未指定ならプロジェクトの browserslist 設定を検出する", () => {
    const targets = resolveTargets(undefined, FIXTURE_WITH_CONFIG);

    expect(targets).toEqual({ safari: 15 << 16 });
  });

  it("クエリも設定もなければ undefined（ダウンレベルなし）", () => {
    // リポジトリ自体に browserslist 設定を置かないことが前提
    const targets = resolveTargets(undefined, import.meta.dirname);

    expect(targets).toBeUndefined();
  });
});
