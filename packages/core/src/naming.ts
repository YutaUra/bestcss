import {
  contentHash,
  generateClassName,
  generateKeyframesName,
  type HashFn,
} from "./class-name.js";
import { normalizeCssForHash } from "./normalize-css.js";

/**
 * 生成名の決め方を利用者側から注入するための層。
 *
 * 既定は「正規化した内容の FNV-1a ハッシュ + bc / bk 接頭辞」だが、
 * 名前の付け方はプロジェクトの事情（デバッグしやすい名前にしたい、
 * 他のツールの命名規約に合わせたい、暗号学的ハッシュにしたい）で
 * 変えたくなる。ゼロランタイムは崩れない（ビルド時にのみ呼ばれる）。
 *
 * 注入する関数に求める性質:
 * - 決定的であること（同じ入力なら常に同じ名前。dev と build、client と
 *   server ビルドで名前が食い違うと SSR した HTML と CSS が一致しない）
 * - 異なる CSS に同じ名前を与えないこと（別スタイルの誤適用になる）
 */

export interface ClassNameInput {
  /** css`` に書かれた CSS（@keyframes の抽出と animation 名の書き換え後） */
  css: string;
  /** 書式ゆらぎを畳んだ CSS。既定の実装がハッシュ入力に使う文字列 */
  normalizedCss: string;
  /** css`` を含むファイルのパス */
  filename: string;
  /** 既定の実装が返す名前。接頭辞の付け替えなど、包んで使える */
  defaultName: string;
}

export interface KeyframesNameInput extends ClassNameInput {
  /** ユーザーが @keyframes に書いた元の名前 */
  originalName: string;
}

export interface NamingStrategy {
  /**
   * 内容ハッシュのアルゴリズムだけを差し替える。
   * className / keyframesName を指定しない場合の既定の実装が使うため、
   * クラス名と @keyframes 名の両方に効く
   */
  hash?: HashFn;
  /** クラス名そのものを決める */
  className?: (input: ClassNameInput) => string;
  /** スコープ化した @keyframes 名そのものを決める */
  keyframesName?: (input: KeyframesNameInput) => string;
  /**
   * 生成したクラス名を CSS のセレクタから見分けるための接頭辞。
   *
   * ビルド時クラス名短縮（ADR-0004）は、プリコンパイル配布された
   * ライブラリ（ADR-0013）の CSS など transform を通らない経路の名前を
   * セレクタから収穫する。className を注入して既定の "bc" から外れた
   * 名前にする場合は、その接頭辞をここで宣言しないと収穫できない
   *
   * @default ["bc"]
   */
  classNamePrefixes?: string[];
}

/** 戦略を解決した、変換パイプラインから呼ぶ形の命名関数 */
export interface ResolvedNaming {
  className(css: string, filename: string): string;
  keyframesName(originalName: string, body: string, filename: string): string;
  classNamePrefixes: readonly string[];
}

export const DEFAULT_CLASS_NAME_PREFIXES: readonly string[] = ["bc"];

// CSS クラス名として安全な形。数字始まりを許さないのは CSS の識別子規則、
// 空白や記号を許さないのは class 属性が空白区切りであること、および
// 短縮リネームのテキスト置換（class-rename）が識別子境界で照合するため
const VALID_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function assertValidName(
  name: string,
  hook: "className" | "keyframesName",
  filename: string,
): string {
  if (!VALID_NAME_RE.test(name)) {
    throw new Error(
      `bestcss: ${filename} — naming.${hook} が返した ${JSON.stringify(name)} は ` +
        `名前として使えません。英字または _ で始まり、英数字・_・- のみを含む ` +
        `文字列を返してください`,
    );
  }
  return name;
}

// 注入時は normalizeCssForHash を 2 回通る。正規化済みを受け取る内部 API で
// 1 回に減らさないのは、既定名の組み立てが 2 箇所に分かれてドリフトするため
export function resolveNaming(strategy: NamingStrategy = {}): ResolvedNaming {
  const hash = strategy.hash ?? contentHash;
  const { className, keyframesName } = strategy;

  return {
    classNamePrefixes:
      strategy.classNamePrefixes ?? DEFAULT_CLASS_NAME_PREFIXES,

    className(css, filename) {
      const defaultName = generateClassName(css, hash);
      if (className === undefined) {
        return defaultName;
      }
      return assertValidName(
        className({
          css,
          normalizedCss: normalizeCssForHash(css),
          filename,
          defaultName,
        }),
        "className",
        filename,
      );
    },

    keyframesName(originalName, body, filename) {
      const defaultName = generateKeyframesName(body, hash);
      if (keyframesName === undefined) {
        return defaultName;
      }
      return assertValidName(
        keyframesName({
          originalName,
          css: body,
          normalizedCss: normalizeCssForHash(body),
          filename,
          defaultName,
        }),
        "keyframesName",
        filename,
      );
    },
  };
}
