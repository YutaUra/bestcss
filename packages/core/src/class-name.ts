/**
 * css`` の中身（生 CSS テキスト）からスコープ用クラス名を生成する。
 *
 * 入力を CSS 内容のみとし、ファイル名を混ぜていない理由:
 * 同一内容の css`` がファイルを跨いで存在するとき同一クラス名に収束させ、
 * Phase 2 の重複排除（同一ルールの共有）の基盤にするため。
 */
// FNV-1a を使う理由: 依存ゼロ・数行で書け、ビルド毎に決定的。
// 暗号学的強度は不要（衝突時はビルド時に検出して対処できる）で、
// crypto.createHash より高速なため。
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 内容から決定的な短いハッシュ文字列を作る（クラス名・keyframes 名で共用） */
export function contentHash(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(36);
}

export function generateClassName(cssText: string): string {
  // CSS クラス名は数字始まりが許されないため "bc" プレフィックスで保証する
  return `bc${contentHash(cssText)}`;
}
