import { resolveTargets, type Targets } from "@bestcss/core";

/**
 * browserslist 解決の結果をプロセス内でキャッシュする。
 * loader はモジュール 1 つごとに呼ばれるため、毎回 browserslist の
 * 設定探索（fs 走査）とクエリ解決を行うとビルド全体で無視できない
 * コストになる
 */
const cache = new Map<string, Targets | undefined>();

export function resolveTargetsCached(
  query: string | string[] | false | undefined,
  root: string,
): Targets | undefined {
  if (query === false) {
    return undefined;
  }
  const key = JSON.stringify([query, root]);
  if (!cache.has(key)) {
    cache.set(key, resolveTargets(query, root));
  }
  return cache.get(key);
}
