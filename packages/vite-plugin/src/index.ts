import { transform } from "@best-css/core";
import type { Plugin } from "vite";

const TRANSFORM_TARGET_RE = /\.[jt]sx?$/;

/**
 * 抽出した CSS を「元ファイル名 + この接尾辞」の仮想モジュールとして登録する。
 * .css で終わる id にしておくことで、Vite 自身の CSS パイプライン
 * （postcss / minify / コード分割）にそのまま処理を委ねられる
 */
const VIRTUAL_CSS_SUFFIX = ".best-css.css";

// Vite の DevEnvironment が持つモジュールグラフの最小構造型。
// vite の型に直接依存しない理由: build 時は moduleGraph が存在せず、
// 判別を「プロパティの有無」で行うため構造型のほうが実態に合う
interface ModuleGraphLike {
  getModuleById(id: string): unknown;
  invalidateModule(mod: never): void;
}

/**
 * 仮想 CSS モジュールをモジュールグラフ上で無効化する（dev のみ）。
 *
 * 元の tsx が編集されても仮想 CSS モジュール自体には「ファイル変更」が
 * 起きないため、明示的に invalidate しないと Vite が古い変換結果を
 * キャッシュから配信し続けてしまう
 */
function invalidateVirtualCss(context: unknown, cssId: string): void {
  const environment = (
    context as { environment?: { moduleGraph?: ModuleGraphLike } }
  ).environment;
  const graph = environment?.moduleGraph;
  if (graph === undefined) {
    return;
  }
  const mod = graph.getModuleById(cssId);
  if (mod !== undefined && mod !== null) {
    graph.invalidateModule(mod as never);
  }
}

export function bestCss(): Plugin {
  const extractedCss = new Map<string, string>();

  return {
    name: "best-css",
    // enforce: "pre" にする理由: JSX 変換（@vitejs/plugin-react や esbuild）より
    // 前にユーザーが書いた元ソースを受け取り、css`` の位置情報を保つため
    enforce: "pre",

    resolveId(source) {
      // 仮想 CSS モジュールはファイルシステムに存在しないため、
      // 他のリゾルバに渡さずここで解決を確定させる
      if (extractedCss.has(source)) {
        return source;
      }
      return null;
    },

    load(id) {
      return extractedCss.get(id) ?? null;
    },

    transform(code, id) {
      if (!TRANSFORM_TARGET_RE.test(id) || id.includes("/node_modules/")) {
        return null;
      }
      const cssId = id + VIRTUAL_CSS_SUFFIX;
      const result = transform(code, { filename: id });

      if (result === null) {
        // css`` が全て削除されたケース。エントリを消すのではなく空にする理由:
        // クライアントに残った古い import からのリクエストに 404 ではなく
        // 空 CSS を返し、スタイルだけ確実に消すため
        if (extractedCss.get(cssId)) {
          extractedCss.set(cssId, "");
          invalidateVirtualCss(this, cssId);
        }
        return null;
      }

      const previousCss = extractedCss.get(cssId);
      extractedCss.set(cssId, result.css);
      if (previousCss !== undefined && previousCss !== result.css) {
        invalidateVirtualCss(this, cssId);
      }

      return {
        code: `${result.code}\nimport ${JSON.stringify(cssId)};\n`,
        map: null,
      };
    },
  };
}
