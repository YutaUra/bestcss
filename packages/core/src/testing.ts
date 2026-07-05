import { generateClassName } from "./class-name.js";
import { extractKeyframes, rewriteAnimationNames } from "./keyframes.js";

/**
 * テスト実行環境（Jest / node:test など、ビルド変換を通さないランナー）
 * 向けの css`` 実装。moduleNameMapper 等で "@bestcss/core" をこの
 * モジュールへ差し替えて使う。
 *
 * 本番の transform と同じ手順（keyframes のスコープ化 → 内容ハッシュ）で
 * クラス名を計算するため、単一ブロックのクラス名は本番ビルドと一致する。
 * ゼロランタイムの原則に反しない理由: このモジュールはテストでのみ
 * 使われ、出荷バンドルには決して入らない。
 *
 * 制限: animation 参照の解決はブロック内に閉じる（本番はファイル内の
 * 全ブロックを見る）。別ブロックで定義した keyframes を参照する場合のみ
 * クラス名が本番とずれる
 */
export function css(
  strings: TemplateStringsArray,
  ...values: never[]
): string {
  if (values.length > 0) {
    throw new Error(
      "bestcss: css`` 内の ${} 補間は未サポートです。" +
        "動的な値は CSS カスタムプロパティ（var(--x) + style 属性）を使ってください。",
    );
  }
  const raw = strings[0] ?? "";
  const { css: blockCss, keyframes } = extractKeyframes(raw);
  const renames = new Map(keyframes.map((kf) => [kf.name, kf.scopedName]));
  return generateClassName(rewriteAnimationNames(blockCss, renames));
}
