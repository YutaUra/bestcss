import { contentHash } from "./class-name.js";

/**
 * css`` ブロック内の @keyframes のスコープ化。
 *
 * keyframes 名は CSS 上グローバルなので、クラス名と同様に内容ハッシュで
 * 命名し直す（"bk" プレフィックス）。内容ハッシュにすることで、同一の
 * keyframes がファイルを跨いで同一名に収束し、重複排除にそのまま乗る。
 * "bc"（クラス）と接頭辞を分けているのは、ビルド時クラス名短縮
 * （ADR-0004）の置換対象と名前空間を衝突させないため。
 */

export interface ExtractedKeyframes {
  /** ユーザーが書いた元の名前 */
  name: string;
  /** 内容ハッシュによるスコープ名 */
  scopedName: string;
  /** ブロック本体（波括弧の中身） */
  body: string;
}

/**
 * css`` の生テキストから、ブロック直下（ネスト深さ 0）の @keyframes を
 * 取り出し、残りの CSS と分離する
 */
export function extractKeyframes(rawCss: string): {
  css: string;
  keyframes: ExtractedKeyframes[];
} {
  const keyframes: ExtractedKeyframes[] = [];
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
    if (depth === 0 && rawCss.startsWith("@keyframes", i)) {
      const head = /^@keyframes\s+([-\w]+)\s*\{/.exec(rawCss.slice(i));
      if (head?.[1] !== undefined) {
        css += rawCss.slice(segmentStart, i);
        // 対応する閉じ括弧まで読み進めて本体を切り出す
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
        const body = rawCss.slice(i + head[0].length, j - 1);
        keyframes.push({
          name: head[1],
          scopedName: `bk${contentHash(body)}`,
          body,
        });
        i = j;
        segmentStart = j;
        continue;
      }
    }
    i++;
  }

  css += rawCss.slice(segmentStart);
  return { css, keyframes };
}

/**
 * animation / animation-name 宣言の値に現れる keyframes 名をスコープ名へ
 * 書き換える。宣言値に限定するのは、"block" のような CSS キーワードと
 * 同名の keyframes が無関係な宣言（display: block 等）を壊さないため
 */
export function rewriteAnimationNames(
  css: string,
  renames: Map<string, string>,
): string {
  if (renames.size === 0) {
    return css;
  }
  return css.replace(
    /(animation(?:-name)?\s*:)([^;}]*)/g,
    (_match, property: string, value: string) =>
      property + value.replace(/[-\w]+/g, (word) => renames.get(word) ?? word),
  );
}
