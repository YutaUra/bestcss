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
 * テキスト（JS チャンク / CSS アセット）内のクラス名をリネーム表に従って置換する。
 * bc 接頭辞の生成名だけを対象にするため、ユーザーコードの他の文字列を
 * 誤って書き換えることはない
 */
export function applyRename(
  text: string,
  renameMap: Map<string, string>,
): string {
  return text.replace(
    /\bbc[a-z0-9]+\b/g,
    (matched) => renameMap.get(matched) ?? matched,
  );
}
