/**
 * css`` ブロック内の @layer の扱い。
 *
 * `@layer name { ... }` は生 CSS 構文としてテンプレート内に書く
 * （css.layer() のような JS API にしない理由: タグ名が css から変わると
 * Prettier / stylelint / エディタ拡張の埋め込み CSS 認識がすべて外れる
 * ことを実測で確認した。生 CSS 構文ならツールチェーンが素通しになる）
 */

export interface ExtractedLayerBlock {
  /** レイヤー名 */
  name: string;
  /** ブロック本体（波括弧の中身） */
  body: string;
}

/**
 * css`` の生テキストから、ブロック直下（ネスト深さ 0）の
 * `@layer name { ... }` を取り出し、残りの CSS と分離する
 */
export function extractLayerBlocks(rawCss: string): {
  css: string;
  layers: ExtractedLayerBlock[];
} {
  const layers: ExtractedLayerBlock[] = [];
  let css = "";
  let segmentStart = 0;
  let depth = 0;
  let i = 0;

  while (i < rawCss.length) {
    const char = rawCss[i];
    if (char === "{") {
      depth++;
      i++;
      continue;
    }
    if (char === "}") {
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && rawCss.startsWith("@layer", i)) {
      const head = /^@layer\s+([\w.-]+)\s*\{/.exec(rawCss.slice(i));
      if (head?.[1] !== undefined) {
        css += rawCss.slice(segmentStart, i);
        let j = i + head[0].length;
        let bodyDepth = 1;
        while (j < rawCss.length && bodyDepth > 0) {
          if (rawCss[j] === "{") {
            bodyDepth++;
          } else if (rawCss[j] === "}") {
            bodyDepth--;
          }
          j++;
        }
        layers.push({ name: head[1], body: rawCss.slice(i + head[0].length, j - 1) });
        i = j;
        segmentStart = j;
        continue;
      }
    }
    i++;
  }

  css += rawCss.slice(segmentStart);
  return { css, layers };
}
