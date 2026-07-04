import { transform as transformCss } from "lightningcss";
import MagicString, { type SourceMap } from "magic-string";
import { parseSync } from "oxc-parser";
import { generateClassName } from "./class-name.js";
import { extractKeyframes, rewriteAnimationNames } from "./keyframes.js";

/** ユーザーが css をここから import したときだけ変換対象とする */
const CSS_TAG_MODULE = "@best-css/core";

export interface TransformOptions {
  filename: string;
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

/** import { css } from "@best-css/core" のローカル名と import 文を探す */
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
    throw new Error(`best-css: ${options.filename} のパースに失敗しました:\n${detail}`);
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
  const keyframesStatements = new Map<string, string>();
  for (const tag of tags) {
    if (tag.quasi.expressions.length > 0) {
      throw new Error(
        `best-css: ${options.filename} — css\`\` 内の \${} 補間は未サポートです。` +
          `動的な値は CSS カスタムプロパティ（var(--x) + style 属性）を使ってください。`,
      );
    }
    const rawCss = tag.quasi.quasis[0]?.value.raw ?? "";
    const { css: blockCss, keyframes } = extractKeyframes(rawCss);
    for (const kf of keyframes) {
      keyframesRenames.set(kf.name, kf.scopedName);
      // scopedName は内容ハッシュなので、同一内容はここで自然に 1 つに収束する
      keyframesStatements.set(
        kf.scopedName,
        `@keyframes ${kf.scopedName} {${kf.body}}`,
      );
    }
    blocks.push({ tag, css: blockCss });
  }

  // 2 パス目: animation 参照を書き換えてからクラス化する。
  // クラス名は書き換え後の CSS から生成し、意味的に同じブロックが
  // ファイルを跨いで同一クラス名に収束するようにする
  const cssChunks: string[] = [...keyframesStatements.values()];
  for (const block of blocks) {
    const rewritten = rewriteAnimationNames(block.css, keyframesRenames);
    const className = generateClassName(rewritten);
    classNames.push(className);
    cssChunks.push(`.${className} {${rewritten}}`);
    ms.overwrite(block.tag.start, block.tag.end, JSON.stringify(className));
  }

  // 変換後は css の参照が残らないため import ごと除去する（ゼロランタイム）。
  // 現状 core の公開 API は css のみなので、この import 文に他の specifier が
  // 混在するケースは考慮しない
  ms.remove(cssImport.declaration.start, cssImport.declaration.end);

  let cssOutput: string;
  try {
    const result = transformCss({
      filename: options.filename,
      code: Buffer.from(cssChunks.join("\n")),
      minify: false,
    });
    cssOutput = result.code.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `best-css: ${options.filename} の CSS の解析に失敗しました: ${message}`,
    );
  }

  return {
    code: ms.toString(),
    css: cssOutput,
    classNames,
    // hires: "boundary" は行内のトークン境界単位でマッピングを出す。
    // 置換箇所（css`` → 文字列リテラル）以外の行内位置も正確に保ち、
    // ブレークポイントやスタックトレースのずれを防ぐため
    map: ms.generateMap({ source: options.filename, hires: "boundary" }),
  };
}
