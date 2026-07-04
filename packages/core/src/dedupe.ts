/**
 * CSS のトップレベル文（ルール / @media ブロック / @import など）を単位に
 * 完全一致の重複を取り除く。
 *
 * ルール単位の AST 比較ではなくトップレベル文のテキスト比較にしている理由:
 * 重複は同一の変換パイプラインが生成した同一 css`` ブロック由来であり
 * バイト単位で一致することが保証される。また @media を丸ごと 1 単位と
 * みなすことで「異なるメディアクエリ内の同一ルール」を誤って統合する
 * 事故が構造的に起きない。
 */
export function dedupeCss(css: string): string {
  const statements = splitTopLevelStatements(css);

  const lastIndexByKey = new Map<string, number>();
  statements.forEach((statement, index) => {
    lastIndexByKey.set(statement.trim(), index);
  });

  // 最後の出現を残す理由: 複数クラスを併用した要素では同一詳細度の
  // ルール間で後方が勝つため、前方を残すと間に挟まったルールとの
  // 勝敗が元の CSS と変わってしまう
  const deduped = statements.filter(
    (statement, index) => lastIndexByKey.get(statement.trim()) === index,
  );

  return deduped.join("\n");
}

/** 波括弧の深さ 0 で CSS をトップレベル文に分割する */
function splitTopLevelStatements(css: string): string[] {
  const statements: string[] = [];
  let depth = 0;
  let start = 0;
  let inString: '"' | "'" | null = null;
  let inComment = false;

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (inComment) {
      if (char === "*" && css[i + 1] === "/") {
        inComment = false;
        i++;
      }
      continue;
    }
    if (inString !== null) {
      if (char === "\\") {
        i++;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === "{") {
      depth++;
      continue;
    }
    if (char === "}") {
      depth--;
      if (depth === 0) {
        statements.push(css.slice(start, i + 1));
        start = i + 1;
      }
      continue;
    }
    // @import / @charset のようなブロックを持たない文はセミコロンで終わる
    if (char === ";" && depth === 0) {
      statements.push(css.slice(start, i + 1));
      start = i + 1;
    }
  }

  const rest = css.slice(start).trim();
  if (rest !== "") {
    statements.push(rest);
  }
  return statements.filter((s) => s.trim() !== "");
}
