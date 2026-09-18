/**
 * ビルド時のクラス名短縮。
 *
 * 内容ハッシュ（bc 接頭辞）は「全クラスが揃う前に衝突なく名前を決める」ための
 * 長さを持つが、ビルド最終段階では全クラスの一覧が確定しているため、
 * 全単射の短い名前（a, b, ..., z, aa, ...）に振り直せる。
 * 名前の長さ × 出現回数が出力サイズを決めるので、頻度の高い順に短い名前を
 * 割り当てる（Huffman 符号と同じ発想）。
 */

const FIRST_CHARS = "abcdefghijklmnopqrstuvwxyz";
const REST_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** index 番目の短縮名（bijective 進法。CSS クラス名は英字始まりが必要） */
function shortName(index: number): string {
  let name = FIRST_CHARS[index % FIRST_CHARS.length] as string;
  let rest = Math.floor(index / FIRST_CHARS.length);
  while (rest > 0) {
    rest -= 1;
    name += REST_CHARS[rest % REST_CHARS.length];
    rest = Math.floor(rest / REST_CHARS.length);
  }
  return name;
}

/** 使用頻度の高い順に短い名前を割り当てたリネーム表を作る */
export function createRenameMap(
  frequencies: Map<string, number>,
): Map<string, string> {
  // 同頻度は元の名前順で割り当て、入力順に依存しない決定的なビルドにする
  const sorted = [...frequencies.entries()].sort(
    ([nameA, countA], [nameB, countB]) =>
      countB - countA || nameA.localeCompare(nameB),
  );
  return new Map(sorted.map(([name], index) => [name, shortName(index)]));
}

/**
 * 生成名が「CSS 識別子として丸ごと一致する」箇所にだけ当たる正規表現を作る。
 *
 * \b ではなく前後の否定先読み / 後読みを使う理由:
 * \b は "-" を単語境界とみなすため、app-hero という名前で app-hero-lg の
 * 前半に当たってしまう。CSS 識別子に使える文字で境界を定義する必要がある
 */
export function createNamePattern(names: Iterable<string>): RegExp {
  // 長い名前を先に並べる: 正規表現の選択は左から最初に一致した枝を採るため、
  // app-hero を先に置くと app-hero-lg が前半だけ一致してしまう
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"))
    .join("|");
  return new RegExp(
    `(?<![A-Za-z0-9_-])(?:${alternatives})(?![A-Za-z0-9_-])`,
    "g",
  );
}

/**
 * CSS のセレクタから、bestcss が生成したクラス名を収穫する正規表現を作る。
 * transform を通らない経路（プリコンパイル配布されたライブラリの CSS、
 * ADR-0013）の名前は、接頭辞でしか見分けられない。
 *
 * 接頭辞の後ろを [a-z0-9]+ に絞り、CSS 識別子に使える文字すべてを
 * 許していない理由: 生成名のハッシュ部は必ず base36（小文字英数字）で、
 * 広げると利用者が手書きした .bc-container のようなクラスまで生成名と
 * 誤認して短縮してしまう（手書きクラスを壊す）
 */
export function createGeneratedSelectorPattern(
  prefixes: readonly string[],
): RegExp {
  const alternatives = prefixes
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\.((?:${alternatives})[a-z0-9]+)`, "g");
}

/** リネーム表ごとに正規表現をキャッシュする（表はビルド中に使い回される） */
const patternCache = new WeakMap<Map<string, string>, RegExp>();

/**
 * テキスト（JS チャンク / CSS アセット）内のクラス名をリネーム表に従って置換する。
 *
 * 接頭辞の正規表現ではなくリネーム表のキーで照合する理由:
 * 命名戦略（NamingStrategy）を注入すると生成名が "bc" 始まりでなくなるため、
 * 接頭辞に依存すると短縮が効かなくなる。表のキーで照合すれば、名前の形が
 * どうであれ「自分が生成した名前だけ」を対象にできる
 */
export function applyRename(
  text: string,
  renameMap: Map<string, string>,
): string {
  if (renameMap.size === 0) {
    return text;
  }
  let pattern = patternCache.get(renameMap);
  if (pattern === undefined) {
    pattern = createNamePattern(renameMap.keys());
    patternCache.set(renameMap, pattern);
  }
  return text.replace(pattern, (matched) => renameMap.get(matched) ?? matched);
}
