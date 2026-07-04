import { transform } from "@best-css/core";
import type { Plugin } from "vite";

const TRANSFORM_TARGET_RE = /\.[jt]sx?$/;

/**
 * 抽出した CSS を「元ファイル名 + この接尾辞」の仮想モジュールとして登録する。
 * .css で終わる id にしておくことで、Vite 自身の CSS パイプライン
 * （postcss / minify / コード分割）にそのまま処理を委ねられる
 */
const VIRTUAL_CSS_SUFFIX = ".best-css.css";

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
      const result = transform(code, { filename: id });
      if (result === null) {
        return null;
      }
      const cssId = id + VIRTUAL_CSS_SUFFIX;
      extractedCss.set(cssId, result.css);
      return {
        code: `${result.code}\nimport ${JSON.stringify(cssId)};\n`,
        map: null,
      };
    },
  };
}
