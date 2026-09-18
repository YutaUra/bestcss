/**
 * 内容ハッシュの入力にする CSS の正規化。
 *
 * Lightning CSS の minify 結果をハッシュ入力にしない理由:
 * lightningcss のバージョンを上げると出力が変わり得るため、依存更新だけで
 * 全クラス名が変わってしまう。クラス名の決定要因は自分たちの管理下に置く。
 *
 * その代わり、値の等価表記（`#ffffff` と `#fff`、`0px` と `0`）や結合子
 * まわりの空白（`&>.b` と `& > .b`）は収束させない。ここで行うのは
 * 「書いた人の書式の癖」だけを畳む操作に限る。
 */

/** この文字の直前の空白は落とす（空白があっても意味が変わらない位置） */
const SWALLOW_SPACE_BEFORE = new Set([";", ",", "{", "}"]);

/**
 * この文字の直後の空白は落とす。
 *
 * `:` を「直後」だけに入れ「直前」に入れていない理由:
 * `& :hover`（子孫の hover）と `&:hover`（自身の hover）は別のセレクタで、
 * `:` の前の空白は結合子として意味を持つ。宣言の `color : red` を
 * `color:red` に畳めなくなるが、セレクタを壊す危険とは引き換えにしない
 * （1 パスの字句処理ではセレクタの `:` と宣言の `:` を区別できない）
 */
const SWALLOW_SPACE_AFTER = new Set([";", ",", "{", "}", ":"]);

const isWhitespace = (char: string): boolean =>
  char === " " ||
  char === "\t" ||
  char === "\n" ||
  char === "\r" ||
  char === "\f";

export function normalizeCssForHash(css: string): string {
  const out: string[] = [];
  let pendingSpace = false;

  const lastChar = (): string => {
    const last = out[out.length - 1];
    return last === undefined ? "" : (last[last.length - 1] as string);
  };
  const flushSpace = (): void => {
    if (!pendingSpace) {
      return;
    }
    pendingSpace = false;
    if (out.length > 0 && !SWALLOW_SPACE_AFTER.has(lastChar())) {
      out.push(" ");
    }
  };
  /** 空白を 1 個ぶん保留する。out が空なら先頭の空白なので捨てる */
  const holdSpace = (): void => {
    if (out.length > 0) {
      pendingSpace = true;
    }
  };

  let i = 0;
  while (i < css.length) {
    const char = css[i] as string;

    if (isWhitespace(char)) {
      holdSpace();
      i++;
      continue;
    }

    // コメントは空白に置き換える。除去してしまうとトークン区切りが消え、
    // `1px/**/2px` が `1px2px` という別の値に変わってしまう
    if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      holdSpace();
      continue;
    }

    // 文字列リテラルは中身をそのまま通す（空白もコメント風の文字列も意味を持つ）
    if (char === '"' || char === "'") {
      flushSpace();
      let j = i + 1;
      while (j < css.length && css[j] !== char) {
        j += css[j] === "\\" ? 2 : 1;
      }
      out.push(css.slice(i, Math.min(j + 1, css.length)));
      i = j + 1;
      continue;
    }

    if (SWALLOW_SPACE_BEFORE.has(char)) {
      pendingSpace = false;
      if (char === ";") {
        // 連続するセミコロンと、ブロック先頭のセミコロンは無意味なので落とす
        const previous = lastChar();
        if (previous === "" || previous === ";" || previous === "{") {
          i++;
          continue;
        }
      }
      if (char === "}" && lastChar() === ";") {
        out.pop();
      }
      out.push(char);
      i++;
      continue;
    }

    flushSpace();
    out.push(char);
    i++;
  }

  // 末尾のセミコロンは有無で意味が変わらない
  if (lastChar() === ";") {
    out.pop();
  }
  return out.join("");
}
