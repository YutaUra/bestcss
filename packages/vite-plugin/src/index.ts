import fs from "node:fs";
import path from "node:path";
import {
  applyRename,
  createRenameMap,
  dedupeCss,
  generateClassName,
  transform,
} from "@best-css/core";
import type { Plugin } from "vite";

const TRANSFORM_TARGET_RE = /\.[jt]sx?$/;

/**
 * 抽出した CSS を「元ファイル名 + この接尾辞」の仮想モジュールとして登録する。
 * .css で終わる id にしておくことで、Vite 自身の CSS パイプライン
 * （postcss / minify / コード分割）にそのまま処理を委ねられる
 */
const VIRTUAL_CSS_SUFFIX = ".best-css.css";

/** 仮想 CSS モジュールの id からハッシュクエリを外し、Map のキーに揃える */
const stripQuery = (id: string): string => id.split("?")[0] ?? id;

export interface BestCssOptions {
  /**
   * ビルド時にクラス名を使用頻度順の短い名前（a, b, ...）へ振り直す。
   * 無効化は、SSR した HTML を長期キャッシュする等でクラス名の
   * ビルド間安定性を優先したい場合を想定している
   *
   * @default true
   */
  minifyClassNames?: boolean;
  /**
   * リネーム表（短縮前 → 短縮後のクラス名）を共有するファイルパス。
   *
   * SSR 構成では HTML（サーバービルド）と CSS（クライアントビルド）が
   * 独立したビルドから出るため、ビルド内の頻度で決まる短縮名は一致しない。
   * クライアントビルドが確定した表をここへ書き出し、サーバービルドが
   * 同じ表を読んで書き換えることで短縮名を一致させる
   * （クライアント → サーバーの順でビルドすること）
   */
  renameMapPath?: string;
}

export function bestCss(options: BestCssOptions = {}): Plugin {
  const minifyClassNames = options.minifyClassNames ?? true;
  const extractedCss = new Map<string, { css: string; map: string }>();
  const generatedClassNames = new Set<string>();
  let root = process.cwd();
  let isProduction = false;
  let sharedRenameMap: Map<string, string> | null = null;

  const resolveRenameMapPath = (): string | null =>
    options.renameMapPath === undefined
      ? null
      : path.resolve(root, options.renameMapPath);

  const loadSharedRenameMap = (): Map<string, string> => {
    if (sharedRenameMap !== null) {
      return sharedRenameMap;
    }
    const mapPath = resolveRenameMapPath();
    if (mapPath === null || !fs.existsSync(mapPath)) {
      throw new Error(
        `best-css: リネーム表 ${mapPath} が見つかりません。` +
          `renameMapPath はクライアントビルドが書き出すため、` +
          `クライアントビルドを先に実行してください。`,
      );
    }
    sharedRenameMap = new Map(
      Object.entries(
        JSON.parse(fs.readFileSync(mapPath, "utf8")) as Record<string, string>,
      ),
    );
    return sharedRenameMap;
  };

  return {
    name: "best-css",

    configResolved(config) {
      root = config.root;
      // command ではなく isProduction で判定する理由: @hono/vite-ssg は
      // ビルド中に内部のモジュールランナー（command=serve の設定）で
      // configResolved を再度呼ぶため、command はビルド中でも serve に
      // 上書きされ得る。isProduction はその場合も true を保つ
      isProduction = config.isProduction;
    },
    // enforce: "pre" にする理由: JSX 変換（@vitejs/plugin-react や esbuild）より
    // 前にユーザーが書いた元ソースを受け取り、css`` の位置情報を保つため
    enforce: "pre",

    resolveId(source) {
      // 仮想 CSS モジュールはファイルシステムに存在しないため、
      // 他のリゾルバに渡さずここで解決を確定させる
      if (extractedCss.has(stripQuery(source))) {
        return source;
      }
      return null;
    },

    load(id) {
      const entry = extractedCss.get(stripQuery(id));
      if (entry === undefined) {
        return null;
      }
      // map を添えることで、css.devSourcemap 有効時に DevTools の Styles
      // ペインから元の tsx（css`` の位置）へ辿れるようになる
      return { code: entry.css, map: entry.map };
    },

    transform(code, id) {
      if (!TRANSFORM_TARGET_RE.test(id) || id.includes("/node_modules/")) {
        return null;
      }
      const result = transform(code, { filename: id });
      if (result === null) {
        // css`` が全て削除された場合、新しいコードに import が残らないため
        // Vite の HMR prune が古い style 要素を除去する。ここでの後始末は不要
        return null;
      }

      const cssId = id + VIRTUAL_CSS_SUFFIX;
      extractedCss.set(cssId, { css: result.css, map: result.cssMap });
      for (const className of result.classNames) {
        generatedClassNames.add(className);
      }

      // サーバー（SSR）向けの変換では CSS import を付与しない。
      // SSR バンドルに必要なのはクラス名だけで、CSS の配信は
      // クライアントビルドの責務のため（サーバーバンドルも汚さない）
      const consumer = (
        this as { environment?: { config?: { consumer?: string } } }
      ).environment?.config?.consumer;
      if (consumer === "server") {
        let serverCode = result.code;
        // リネーム表の適用を generateBundle ではなく変換時に行う理由:
        // @hono/vite-ssg のように、バンドルを作らずモジュールランナーで
        // サーバーコードを実行して HTML を書き出すツールでは
        // generateBundle が HTML 生成経路を通らないため。
        // dev（vite dev）は表を使わない（クライアント側も bc 名のため）
        if (isProduction && resolveRenameMapPath() !== null) {
          serverCode = applyRename(serverCode, loadSharedRenameMap());
        }
        return { code: serverCode, map: result.map };
      }

      // import URL に CSS の内容ハッシュを付ける理由: ブラウザは ESM モジュールを
      // URL 単位でキャッシュするため、サーバー側の内容更新だけでは再取得されない。
      // モジュールグラフの invalidate（?t= 方式）はグラフの内部状態に依存して
      // 空振りし得たため、内容が変われば URL が必ず変わるこの方式にした
      const versionedCssId = `${cssId}?hash=${generateClassName(result.css)}`;
      // import 行は map 生成後の末尾追記だが、行の追加は既存行の
      // マッピングをずらさないためソースマップはそのまま有効
      return {
        code: `${result.code}\nimport ${JSON.stringify(versionedCssId)};\n`,
        map: result.map,
      };
    },

    generateBundle: {
      // プラグイン全体は enforce: "pre" のため、order: "post" を付けないと
      // Vite 内部（css-post）が CSS アセットを bundle に追加する前に走ってしまう
      order: "post",
      handler(_options, bundle) {
        // 同一内容の css`` が複数ファイルにあると、クラス名は内容ハッシュで
        // 同一に収束する一方、CSS 本文は各仮想モジュールから重複して出力される。
        // Vite の cssMinify（Lightning CSS）も重複をマージするが、minify を
        // 無効にした構成でも「サイズ最適化」の保証が消えないよう自前でも行う
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === "asset" && fileName.endsWith(".css")) {
            output.source = dedupeCss(String(output.source));
          }
        }

        if (!minifyClassNames) {
          return;
        }

        const renameMapPath = resolveRenameMapPath();
        const consumer = (
          this as { environment?: { config?: { consumer?: string } } }
        ).environment?.config?.consumer;

        if (consumer === "server") {
          // サーバービルドは自分の頻度で短縮しない。CSS を持つのは
          // クライアントビルドであり、独立に計算した短縮名は一致しないため。
          // 表があるときだけ、それに従って書き換える（transform 時に
          // 適用済みだが、バンドル型 SSR での取りこぼしをここで拾う）
          if (renameMapPath === null) {
            return;
          }
          const sharedMap = loadSharedRenameMap();
          for (const output of Object.values(bundle)) {
            if (output.type === "chunk") {
              output.code = applyRename(output.code, sharedMap);
            }
          }
          return;
        }

        if (generatedClassNames.size === 0) {
          return;
        }

        // 使用頻度は JS チャンク内の静的な出現回数を代理指標にする。
        // 実行時の描画回数は分からないが、全クラスが 1〜3 文字になるため
        // 順位の精度がサイズに与える影響は小さい
        const frequencies = new Map<string, number>(
          [...generatedClassNames].map((name) => [name, 0]),
        );
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") {
            continue;
          }
          for (const matched of output.code.matchAll(/\bbc[a-z0-9]+\b/g)) {
            const count = frequencies.get(matched[0]);
            if (count !== undefined) {
              frequencies.set(matched[0], count + 1);
            }
          }
        }

        const renameMap = createRenameMap(frequencies);
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === "chunk") {
            output.code = applyRename(output.code, renameMap);
          } else if (fileName.endsWith(".css")) {
            output.source = applyRename(String(output.source), renameMap);
          }
        }

        // 確定した表を書き出し、後続のサーバービルドに共有する。
        // CSS アセットを持つ環境に限定する理由: SSG 等が走らせる空の
        // クライアント環境が、確定済みの表を上書きするのを防ぐため
        const hasCssAsset = Object.keys(bundle).some((fileName) =>
          fileName.endsWith(".css"),
        );
        if (renameMapPath !== null && hasCssAsset) {
          fs.mkdirSync(path.dirname(renameMapPath), { recursive: true });
          fs.writeFileSync(
            renameMapPath,
            JSON.stringify(Object.fromEntries(renameMap), null, 2),
          );
        }
      },
    },
  };
}
