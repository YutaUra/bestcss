import browserslist from "browserslist";
import { browserslistToTargets, type Targets } from "lightningcss";

export type { Targets } from "lightningcss";

/**
 * browserslist クエリを Lightning CSS の Targets へ解決する。
 *
 * 優先順位:
 * 1. 明示されたクエリ（プラグインの targets オプション）
 * 2. プロジェクトの browserslist 設定（package.json / .browserslistrc）
 * 3. どちらもなければ undefined（ダウンレベルなし = モダンブラウザ前提）
 *
 * 3 をデフォルトにするのは、bestcss の思想が「生 CSS をそのまま出荷する」
 * ことにあり、書いた構文の暗黙の変換は明示的な意思表示（設定）と
 * 引き換えであるべきだから
 */
export function resolveTargets(
  query: string | string[] | undefined,
  root: string,
): Targets | undefined {
  if (query !== undefined) {
    return browserslistToTargets(browserslist(query));
  }
  const config = browserslist.loadConfig({ path: root });
  if (config === undefined) {
    return undefined;
  }
  return browserslistToTargets(browserslist(config));
}
