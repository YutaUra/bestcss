import manifestData from "virtual:bestcss/route-css";
import { matchRouteCss } from "./route-css-match.js";

/**
 * SSR の renderer から、現在のルートに必要な CSS の href 一覧を得る。
 *
 * manifest（ルート → CSS ファイル一覧）は仮想モジュールとして
 * ビルド時にインラインされるため、実行時のファイルアクセスは発生しない
 * （serverless 環境でも動く）。dev では空配列を返す
 * （スタイルは virtual:bestcss/dev-styles 経由で注入される）
 */
export function routeCssHrefs(requestPath: string): string[] {
  const manifest = manifestData as Record<string, string[]> | null;
  if (manifest === null) {
    return [];
  }
  return matchRouteCss(manifest, requestPath).map((file) => `/${file}`);
}
