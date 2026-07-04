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
}

export function bestCss(options: BestCssOptions = {}): Plugin {
  const minifyClassNames = options.minifyClassNames ?? true;
  const extractedCss = new Map<string, string>();
  const generatedClassNames = new Set<string>();

  return {
    name: "best-css",
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
      return extractedCss.get(stripQuery(id)) ?? null;
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
      extractedCss.set(cssId, result.css);
      for (const className of result.classNames) {
        generatedClassNames.add(className);
      }

      // import URL に CSS の内容ハッシュを付ける理由: ブラウザは ESM モジュールを
      // URL 単位でキャッシュするため、サーバー側の内容更新だけでは再取得されない。
      // モジュールグラフの invalidate（?t= 方式）はグラフの内部状態に依存して
      // 空振りし得たため、内容が変われば URL が必ず変わるこの方式にした
      const versionedCssId = `${cssId}?hash=${generateClassName(result.css)}`;
      return {
        code: `${result.code}\nimport ${JSON.stringify(versionedCssId)};\n`,
        map: null,
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

        if (!minifyClassNames || generatedClassNames.size === 0) {
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
      },
    },
  };
}
