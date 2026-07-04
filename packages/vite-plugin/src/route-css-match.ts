/**
 * リクエストパスから、そのルートに必要な CSS ファイル一覧を引く。
 *
 * manifest のキーはルートファイルの相対パス（拡張子なし）。
 * "_" 始まりのキー（_renderer 等の共通ファイル）は全ページに含める。
 * 動的セグメント（$id 等）のマッチングは未対応（ADR-0007 参照）
 */
export function matchRouteCss(
  manifest: Record<string, string[]>,
  requestPath: string,
): string[] {
  const trimmed = requestPath.replace(/^\/+|\/+$/g, "");
  const candidates =
    trimmed === "" ? ["index"] : [trimmed, `${trimmed}/index`];

  const files = new Set<string>();
  for (const [routeKey, cssFiles] of Object.entries(manifest)) {
    if (routeKey.startsWith("_") || candidates.includes(routeKey)) {
      for (const file of cssFiles) {
        files.add(file);
      }
    }
  }
  return [...files];
}
