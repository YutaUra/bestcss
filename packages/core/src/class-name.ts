import { normalizeCssForHash } from "./normalize-css.js";

/**
 * css`` の中身（生 CSS テキスト）からスコープ用クラス名を生成する。
 *
 * 入力を CSS 内容のみとし、ファイル名を混ぜていない理由:
 * 同一内容の css`` がファイルを跨いで存在するとき同一クラス名に収束させ、
 * 重複排除（同一ルールの共有）の基盤にするため。
 *
 * ハッシュ前に正規化を挟む理由:
 * 生テキストのままだとインデントやコメントの増減でクラス名が変わり、
 * 長期キャッシュが無駄に失効する。上の「収束」も書式が違うだけで崩れる
 */
// FNV-1a を使う理由: 依存ゼロ・数行で書け、ビルド毎に決定的。
// 暗号学的強度は不要（内容アドレスとしての一意性だけが要件）で、
// crypto.createHash より高速なため。
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * base36 の桁数。36^7 > 2^32 なので、32bit を桁落ちなく表現できる最小の桁数。
 * ゼロ埋めして固定長にする理由: 桁落ちで名前の長さが 1〜7 文字とばらつくと、
 * 出力サイズの見積もりもクラス名短縮（ADR-0004）前の HTML サイズも
 * 内容次第で揺れてしまう
 */
const HASH_LENGTH = 7;

/** 任意のテキストから決定的な固定長ハッシュ文字列を作る（正規化は行わない） */
export function contentHash(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(36).padStart(HASH_LENGTH, "0");
}

/** 内容ハッシュのアルゴリズム。命名戦略から差し替えられる */
export type HashFn = (text: string) => string;

/** css`` ブロックに与える既定のクラス名 */
export function generateClassName(
  cssText: string,
  hash: HashFn = contentHash,
): string {
  // CSS クラス名は数字始まりが許されないため "bc" プレフィックスで保証する
  return `bc${hash(normalizeCssForHash(cssText))}`;
}

/**
 * @keyframes に与える既定の名前。
 * "bc"（クラス）と接頭辞を分けているのは、ビルド時クラス名短縮
 * （ADR-0004）の置換対象と名前空間を衝突させないため
 */
export function generateKeyframesName(
  body: string,
  hash: HashFn = contentHash,
): string {
  return `bk${hash(normalizeCssForHash(body))}`;
}
