import { encode } from "@jridgewell/sourcemap-codec";
import { transform as transformCss } from "lightningcss";
import MagicString, { type SourceMap } from "magic-string";
import { parseSync } from "oxc-parser";
import { extractLayerBlocks } from "./cascade-layers.js";
import { generateClassName } from "./class-name.js";
import { extractKeyframes, rewriteAnimationNames } from "./keyframes.js";

/** ユーザーが css をここから import したときだけ変換対象とする */
const CSS_TAG_MODULE = "@bestcss/core";

export interface TransformOptions {
  filename: string;
  /**
   * カスケードレイヤーの順序宣言（下位 → 上位）。
   * css`` 内で `@layer name { ... }` を使う場合は必須で、名前は
   * この一覧に含まれていなければならない（「初出順」依存の
   * 非決定的なレイヤー順を構造的に排除するため）
   */
  layers?: string[];
}

export interface TransformResult {
  /** css`` をクラス名リテラルに置換し、import を除去したコード */
  code: string;
  /** 抽出・スコープ化された CSS */
  css: string;
  /** このファイルから生成したクラス名（ビルド時の短縮リネームの対象特定に使う） */
  classNames: string[];
  /** 変換後コードから元ソースへのソースマップ */
  map: SourceMap;
  /** 出力 CSS から元ソース（css`` の位置）へのソースマップ（JSON 文字列） */
  cssMap: string;
}

/** code 中のオフセットを 0-based の行番号に変換する */
function lineNumberAt(code: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === "\n") {
      line++;
    }
  }
  return line;
}

// oxc-parser の AST 型を最小限の構造型で扱う。
// oxc の型定義に依存しない理由: パーサー差し替え（ADR-0002 の見直し等）の際に
// 影響範囲を walk / 判別ロジックに閉じ込めるため。
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

interface TaggedTemplateNode extends AstNode {
  tag: AstNode & { name?: string };
  quasi: AstNode & {
    quasis: Array<{ value: { raw: string } }>;
    expressions: unknown[];
  };
}

function walk(node: unknown, visit: (node: AstNode) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }
  if (node !== null && typeof node === "object") {
    const candidate = node as Partial<AstNode>;
    if (typeof candidate.type === "string") {
      visit(node as AstNode);
    }
    for (const value of Object.values(node)) {
      walk(value, visit);
    }
  }
}

/** import { css } from "@bestcss/core" のローカル名と import 文を探す */
function findCssImport(
  body: unknown[],
): { localName: string; declaration: AstNode } | null {
  for (const stmt of body as AstNode[]) {
    if (stmt.type !== "ImportDeclaration") {
      continue;
    }
    const source = stmt["source"] as { value?: string };
    if (source.value !== CSS_TAG_MODULE) {
      continue;
    }
    const specifiers = stmt["specifiers"] as Array<
      AstNode & {
        imported?: { name?: string };
        local?: { name?: string };
      }
    >;
    for (const spec of specifiers) {
      if (
        spec.type === "ImportSpecifier" &&
        spec.imported?.name === "css" &&
        spec.local?.name !== undefined
      ) {
        return { localName: spec.local.name, declaration: stmt };
      }
    }
  }
  return null;
}

export function transform(
  code: string,
  options: TransformOptions,
): TransformResult | null {
  // パース前の文字列検索で早期リターンする理由:
  // 変換対象は通常ごく一部のファイルであり、全ファイルの AST 構築を
  // 避けることがビルド全体の速度に効くため。
  if (!code.includes(CSS_TAG_MODULE)) {
    return null;
  }

  const parsed = parseSync(options.filename, code);
  if (parsed.errors.length > 0) {
    const detail = parsed.errors.map((e) => e.message).join("\n");
    throw new Error(`bestcss: ${options.filename} のパースに失敗しました:\n${detail}`);
  }

  const program = parsed.program as unknown as { body: unknown[] };
  const cssImport = findCssImport(program.body);
  if (cssImport === null) {
    return null;
  }

  const tags: TaggedTemplateNode[] = [];
  walk(program.body, (node) => {
    if (node.type !== "TaggedTemplateExpression") {
      return;
    }
    const tagged = node as TaggedTemplateNode;
    if (
      tagged.tag.type === "Identifier" &&
      tagged.tag.name === cssImport.localName
    ) {
      tags.push(tagged);
    }
  });
  if (tags.length === 0) {
    return null;
  }

  const ms = new MagicString(code);
  const classNames: string[] = [];

  // 1 パス目: 全ブロックから @keyframes を抽出する。
  // 参照の解決をファイル単位にする（CSS Modules と同じメンタルモデル）ため、
  // クラス化より先に全ブロック分のリネーム表を確定させる必要がある
  const blocks: Array<{ tag: TaggedTemplateNode; css: string }> = [];
  const keyframesRenames = new Map<string, string>();
  const keyframesStatements = new Map<
    string,
    { statement: string; originLine: number }
  >();
  for (const tag of tags) {
    if (tag.quasi.expressions.length > 0) {
      throw new Error(
        `bestcss: ${options.filename} — css\`\` 内の \${} 補間は未サポートです。` +
          `動的な値は CSS カスタムプロパティ（var(--x) + style 属性）を使ってください。`,
      );
    }
    const rawCss = tag.quasi.quasis[0]?.value.raw ?? "";
    const { css: blockCss, keyframes } = extractKeyframes(rawCss);
    for (const kf of keyframes) {
      keyframesRenames.set(kf.name, kf.scopedName);
      // scopedName は内容ハッシュなので、同一内容はここで自然に 1 つに収束する
      if (!keyframesStatements.has(kf.scopedName)) {
        keyframesStatements.set(kf.scopedName, {
          statement: `@keyframes ${kf.scopedName} {${kf.body}}`,
          originLine: lineNumberAt(code, tag.start),
        });
      }
    }
    blocks.push({ tag, css: blockCss });
  }

  // 2 パス目: animation 参照を書き換えてからクラス化する。
  // クラス名は書き換え後の CSS から生成し、意味的に同じブロックが
  // ファイルを跨いで同一クラス名に収束するようにする。
  // あわせて、合成 CSS の各行が元ソースのどの行由来かを記録し、
  // 出力 CSS → tsx のソースマップの入力にする
  const cssChunks: string[] = [];
  const lineOrigins: number[] = [];
  const pushChunk = (
    text: string,
    originLine: number,
    trackPerLine: boolean,
  ): void => {
    const lineCount = text.split("\n").length;
    for (let i = 0; i < lineCount; i++) {
      // trackPerLine 時はブロック内の行ずれを追う（ブロック先頭行 + i）。
      // keyframes は抽出で行構造が変わるため定義ブロックの先頭行に丸める
      lineOrigins.push(trackPerLine ? originLine + i : originLine);
    }
    cssChunks.push(text);
  };

  for (const kf of keyframesStatements.values()) {
    pushChunk(kf.statement, kf.originLine, false);
  }
  let usesLayers = false;
  for (const block of blocks) {
    const rewritten = rewriteAnimationNames(block.css, keyframesRenames);
    // クラス名はレイヤー構文込みでハッシュする（同一宣言でもレイヤーが
    // 違えばカスケード上は別物のため、別クラスに分離する）
    const className = generateClassName(rewritten);
    classNames.push(className);
    const originLine = lineNumberAt(code, block.tag.start);
    const { css: unlayeredCss, layers: layerBlocks } =
      extractLayerBlocks(rewritten);
    for (const layer of layerBlocks) {
      usesLayers = true;
      if (options.layers === undefined) {
        throw new Error(
          `bestcss: ${options.filename} — @layer を使うには、プラグインの ` +
            `layers オプションでレイヤー順を宣言してください` +
            `（例: bestCss({ layers: ["base", "components", "utilities"] })）。`,
        );
      }
      if (!options.layers.includes(layer.name)) {
        throw new Error(
          `bestcss: ${options.filename} — レイヤー "${layer.name}" は layers ` +
            `設定（${options.layers.join(", ")}）に含まれていません。` +
            `レイヤー順を決定的に保つため、使用する名前はすべて宣言が必要です。`,
        );
      }
      pushChunk(
        `@layer ${layer.name} {\n.${className} {${layer.body}}\n}`,
        originLine,
        false,
      );
    }
    if (unlayeredCss.trim() !== "") {
      pushChunk(`.${className} {${unlayeredCss}}`, originLine, true);
    }
    ms.overwrite(block.tag.start, block.tag.end, JSON.stringify(className));
  }

  // 合成 CSS → 元 tsx の行マッピング。Lightning CSS に inputSourceMap として
  // 渡すことで、出力 CSS のソースマップが元 tsx まで連鎖する
  const inputSourceMap = JSON.stringify({
    version: 3,
    file: options.filename,
    sources: [options.filename],
    sourcesContent: [code],
    names: [],
    mappings: encode(lineOrigins.map((line) => [[0, 0, line, 0]])),
  });

  // 変換後は css の参照が残らないため import ごと除去する（ゼロランタイム）。
  // 現状 core の公開 API は css のみなので、この import 文に他の specifier が
  // 混在するケースは考慮しない
  ms.remove(cssImport.declaration.start, cssImport.declaration.end);

  let cssOutput: string;
  let cssMap: string;
  try {
    const result = transformCss({
      filename: options.filename,
      code: Buffer.from(cssChunks.join("\n")),
      minify: false,
      sourceMap: true,
      inputSourceMap,
    });
    cssOutput = result.code.toString();
    // map が返らない場合は入力マップで代用する（行単位の近似としては有効）
    cssMap = result.map?.toString() ?? inputSourceMap;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `bestcss: ${options.filename} の CSS の解析に失敗しました: ${message}`,
    );
  }

  // レイヤーを使うファイルは先頭に順序宣言を置く。全ファイルが同一の
  // 完全な宣言を持つことで、モジュールの読み込み順に依らずドキュメント
  // 全体のレイヤー順が一意に定まる。Lightning CSS を通した後に付与する
  // 理由: 最適化で宣言から後続レイヤー名が切り詰められ、ファイル内の
  // ブロック出現順に依存した順序へ壊れることを実測で確認したため
  if (usesLayers && options.layers !== undefined) {
    cssOutput = `@layer ${options.layers.join(", ")};\n${cssOutput}`;
    // 出力が 1 行増えるため、CSS ソースマップの行を 1 つずらす
    const parsedMap = JSON.parse(cssMap) as { mappings: string };
    parsedMap.mappings = `;${parsedMap.mappings}`;
    cssMap = JSON.stringify(parsedMap);
  }

  return {
    code: ms.toString(),
    css: cssOutput,
    cssMap,
    classNames,
    // hires: "boundary" は行内のトークン境界単位でマッピングを出す。
    // 置換箇所（css`` → 文字列リテラル）以外の行内位置も正確に保ち、
    // ブレークポイントやスタックトレースのずれを防ぐため
    map: ms.generateMap({ source: options.filename, hires: "boundary" }),
  };
}
