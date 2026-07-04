import path from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { bestCss } from "./index.js";

const FIXTURE = path.resolve(import.meta.dirname, "__fixtures__/basic.ts");
const DEDUP_FIXTURE = path.resolve(
  import.meta.dirname,
  "__fixtures__/dedup/entry.ts",
);
const RESET_FIXTURE = path.resolve(
  import.meta.dirname,
  "__fixtures__/reset/entry.ts",
);

/** fixture を vite build に通し、JS チャンクと CSS アセットを取り出すヘルパー */
async function buildFixture(
  entry: string = FIXTURE,
  options: {
    cssMinify?: boolean;
    minifyClassNames?: boolean;
    sourcemap?: boolean;
  } = {},
): Promise<{ js: string; css: string; map: unknown }> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [bestCss({ minifyClassNames: options.minifyClassNames })],
    build: {
      write: false,
      cssMinify: options.cssMinify ?? true,
      sourcemap: options.sourcemap ?? false,
      lib: {
        entry,
        formats: ["es"],
        fileName: "out",
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
  );
  const chunk = outputs.find((o) => o.type === "chunk");
  const cssAsset = outputs.find(
    (o) => o.type === "asset" && o.fileName.endsWith(".css"),
  );
  if (chunk?.type !== "chunk") {
    throw new Error("JS チャンクが出力されていません");
  }
  if (cssAsset?.type !== "asset") {
    throw new Error("CSS アセットが出力されていません");
  }
  return { js: chunk.code, css: String(cssAsset.source), map: chunk.map };
}

describe("bestCss プラグイン", () => {
  it("Vite が識別できるプラグイン名 bestcss を持つ", () => {
    const plugin = bestCss();

    expect(plugin.name).toBe("bestcss");
  });

  it("vite build で css`` がクラス名に置換され、CSS がアセットとして出力される", async () => {
    const { js, css } = await buildFixture(FIXTURE, {
      minifyClassNames: false,
    });

    expect(js).not.toContain("css`");
    expect(js).toMatch(/"bc[a-z0-9]+"/);
    expect(css).toMatch(/\.bc[a-z0-9]+/);
    expect(css).toMatch(/color:\s*red/);
  });

  it("production build ではクラス名が短縮される（デフォルト有効）", async () => {
    const { js, css } = await buildFixture();

    // fixture のクラスは 1 つなので最短の "a" が割り当てられる
    expect(js).toMatch(/"a"/);
    expect(js).not.toMatch(/bc[a-z0-9]{4,}/);
    expect(css).toContain(".a");
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
  });

  it("出力 JS にランタイムコードが残らない（ゼロランタイム）", async () => {
    const { js } = await buildFixture();

    expect(js).not.toContain("@bestcss/core");
    // css スタブ（実行時エラーを投げるコード）がバンドルされていないこと
    expect(js).not.toContain("ビルド時に変換");
  });

  it("複数ファイルの同一 css`` は最終 CSS アセットで 1 ルールに重複排除される", async () => {
    const { js, css } = await buildFixture(DEDUP_FIXTURE, {
      minifyClassNames: false,
    });

    // クラス名は内容ハッシュなので両ファイルで同一に収束している
    const classNames = [...new Set(js.match(/[`"]bc[a-z0-9]+[`"]/g) ?? [])];
    expect(classNames).toHaveLength(1);
    // CSS 側もルールが 1 回だけ出力される
    expect(css.match(/\.bc[a-z0-9]+/g)).toHaveLength(1);
  });

  it("cssMinify を無効にしても重複排除される（minifier の挙動に依存しない）", async () => {
    const { css } = await buildFixture(DEDUP_FIXTURE, {
      cssMinify: false,
      minifyClassNames: false,
    });

    expect(css.match(/\.bc[a-z0-9]+/g)).toHaveLength(1);
  });

  it("sourcemap 有効時、ソースマップが変換前の元ソースまで連鎖する", async () => {
    const { map } = await buildFixture(FIXTURE, { sourcemap: true });

    expect(map).toBeTruthy();
    // sourcesContent が css`` を含む = 変換前のソースを指せている。
    // プラグインが map を返さないと、変換後コードがソース扱いになる
    expect(JSON.stringify(map)).toContain("css`");
  });

  it("SSR ビルドでは CSS import を付与しない（CSS はクライアントビルドが配信する）", async () => {
    // SSR 構成ではクラス名がクライアントビルドの CSS と一致する必要が
    // あるため minifyClassNames: false が前提（README の SSR ガイド参照）
    const result = await build({
      configFile: false,
      logLevel: "silent",
      plugins: [bestCss({ minifyClassNames: false })],
      build: {
        write: false,
        ssr: FIXTURE,
        rollupOptions: {
          external: ["@bestcss/core"],
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(
      (r) => (r as { output: Rollup.OutputBundle[string][] }).output,
    );
    const chunk = outputs.find((o) => o.type === "chunk");

    // 変換自体は行われ、クラス名は SSR でレンダリングできる
    expect(chunk?.type === "chunk" && chunk.code).toMatch(/"bc[a-z0-9]+"/);
    // CSS の side-effect import はサーバーバンドルに残さない
    expect(chunk?.type === "chunk" && chunk.code).not.toContain(
      "bestcss.css",
    );
  });

  it("ソースを JS として import せずとも仮想 CSS モジュールを単独でロードできる", async () => {
    const entry = path.resolve(
      import.meta.dirname,
      "__fixtures__/lazy/entry.ts",
    );

    const { css } = await buildFixture(entry, { minifyClassNames: false });

    expect(css).toContain("77px");
  });

  it("reset.css を import で opt-in でき、コンポーネントスタイルより前に出力される", async () => {
    const { css } = await buildFixture(RESET_FIXTURE);

    expect(css).toContain("box-sizing");
    // reset は import 順に従い、コンポーネントのルールより前に来る
    expect(css.indexOf("box-sizing")).toBeLessThan(css.indexOf("color:"));
  });

  it("クラス名短縮と重複排除が両立する", async () => {
    const { css } = await buildFixture(DEDUP_FIXTURE);

    // 同一内容 2 ファイル分が 1 ルールに収束し、名前も短縮される
    expect(css.match(/\.a\b/g)).toHaveLength(1);
    expect(css).not.toMatch(/\.bc[a-z0-9]+/);
  });
});
