import type { NamingStrategy } from "@bestcss/core";

/**
 * 元ファイルのパス → 命名戦略の受け渡し表。
 *
 * loader options ではなくモジュールスコープの表を使う理由:
 * css loader（元ファイルを CSS として再読み込みする側、ADR-0008）への
 * オプションは matchResource のリクエスト文字列に載せた JSON クエリで
 * 渡るため、関数を含む値を運べない。命名戦略が css loader に届かないと
 * JS 側のクラス名リテラルと CSS 側のセレクタが食い違う。
 *
 * 成立する前提: 2 つの loader は同一プロセスで同じモジュール実体を共有し、
 * css loader は必ずメイン loader が発行した import から起動するため
 * 登録が先に済んでいる
 */
const strategies = new Map<string, NamingStrategy>();

export function registerNaming(
  filename: string,
  naming: NamingStrategy | undefined,
): void {
  if (naming === undefined) {
    strategies.delete(filename);
    return;
  }
  strategies.set(filename, naming);
}

export function getNaming(filename: string): NamingStrategy | undefined {
  return strategies.get(filename);
}
