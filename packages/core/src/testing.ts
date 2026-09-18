import { extractKeyframes, rewriteAnimationNames } from "./keyframes.js";
import { resolveNaming, type NamingStrategy } from "./naming.js";

/** テスト実行環境向けの css`` が返す型（本番の変換結果と同じクラス名文字列） */
type TestingCss = (strings: TemplateStringsArray, ...values: never[]) => string;

/** createCss に渡す設定。本番ビルド（プラグイン）と同じ値を渡す */
export interface CreateCssOptions {
  /** クラス名 / @keyframes 名の決め方。プラグインに渡したものと揃える */
  naming?: NamingStrategy;
}

/**
 * テスト実行環境（Jest / node:test など、ビルド変換を通さないランナー）
 * 向けの css`` 実装を作る。moduleNameMapper 等で "@bestcss/core" を
 * この実装へ差し替えて使う。
 *
 * 命名戦略を注入している場合はこの関数で同じ戦略を渡す必要がある。
 * 渡さないと生成されるクラス名が本番ビルドとずれ、クラス名を期待する
 * スナップショットが食い違う
 */
export function createCss(options: CreateCssOptions = {}): TestingCss {
  const naming = resolveNaming(options.naming);
  const filename = "@bestcss/core/testing";

  return (strings, ...values) => {
    if (values.length > 0) {
      throw new Error(
        "bestcss: css`` 内の ${} 補間は未サポートです。" +
          "動的な値は CSS カスタムプロパティ（var(--x) + style 属性）を使ってください。",
      );
    }
    const raw = strings[0] ?? "";
    const { css: blockCss, keyframes } = extractKeyframes(
      raw,
      naming,
      filename,
    );
    const renames = new Map(keyframes.map((kf) => [kf.name, kf.scopedName]));
    return naming.className(
      rewriteAnimationNames(blockCss, renames),
      filename,
    );
  };
}

/**
 * 既定の命名戦略を使う css``。
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
export const css: TestingCss = createCss();
