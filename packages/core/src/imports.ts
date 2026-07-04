import { parseSync } from "oxc-parser";

/**
 * ソースコードから import / export-from / 動的 import の指定子を列挙する。
 *
 * ルート単位の CSS 収集（routeStyles）で import グラフを辿るための部品。
 * 依存の解決（相対パス → 実ファイル）はバンドラー側の resolver に任せ、
 * ここは指定子の抽出だけを担う
 */
export function collectImportSources(code: string, filename: string): string[] {
  const parsed = parseSync(filename, code);
  const sources: string[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (node === null || typeof node !== "object") {
      return;
    }
    const candidate = node as {
      type?: string;
      source?: { type?: string; value?: string };
    };
    if (
      (candidate.type === "ImportDeclaration" ||
        candidate.type === "ExportNamedDeclaration" ||
        candidate.type === "ExportAllDeclaration" ||
        candidate.type === "ImportExpression") &&
      typeof candidate.source?.value === "string"
    ) {
      sources.push(candidate.source.value);
    }
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit((parsed.program as unknown as { body: unknown[] }).body);
  return sources;
}
