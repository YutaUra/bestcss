import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cssLang from "@shikijs/langs/css";
import jsLang from "@shikijs/langs/javascript";
import jsxLang from "@shikijs/langs/jsx";
import scssLang from "@shikijs/langs/scss";
import tsxLang from "@shikijs/langs/tsx";
import tsLang from "@shikijs/langs/typescript";
import { defineConfig } from "vitepress";

// ts / tsx コードブロック内の css`` を CSS としてハイライトするための
// TextMate injection grammar（vscode-styled-components から vendor。
// 経緯は ../../syntaxes/README.md を参照）。Shiki は VS Code と同じ
// 文法エンジンなので、拡張の grammar をそのまま注入できる
const SYNTAXES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../syntaxes",
);
const readGrammar = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(SYNTAXES, file), "utf8"));
const cssStyledGrammar = {
  ...readGrammar("css.styled.json"),
  name: "source.css.styled",
  // css.styled.json はプロパティ名や値の判定を標準 CSS / SCSS 文法へ
  // 委譲している（source.css#property-names 等）。VS Code と違い Shiki は
  // 参照先の文法を自動ロードしないため、明示しないと include が
  // 解決されず css`` の中身が単色のままになる
  embeddedLangs: ["css", "scss"],
};
const styledInjectionGrammar = {
  ...readGrammar("styled-components.json"),
  name: "styled",
  injectTo: ["source.ts", "source.tsx", "source.js", "source.jsx"],
  embeddedLangs: ["source.css.styled"],
};

// GitHub Pages（https://yutaura.github.io/bestcss/）でホストするための base
const BASE = "/bestcss/";

const jaSidebar = [
  {
    text: "はじめる",
    items: [
      { text: "Vite でセットアップ", link: "/vite/" },
      { text: "webpack / Next.js でセットアップ", link: "/webpack/" },
    ],
  },
  {
    text: "コア",
    items: [
      { text: "概要", link: "/core/" },
      { text: "css`` の文法", link: "/core/01-syntax" },
      { text: "内部のしくみ", link: "/core/02-how-it-works" },
      {
        text: "Tailwind / UnoCSS からの移行",
        link: "/core/03-migrate-from-utility-frameworks",
      },
      { text: "エディタとツールチェーン", link: "/core/04-tooling" },
      { text: "CSS 変数とデザイントークン", link: "/core/05-css-variables" },
      { text: "動的なスタイルの 4 パターン", link: "/core/06-dynamic-styles" },
    ],
  },
  {
    text: "Vite プラグイン",
    items: [
      { text: "セットアップとオプション", link: "/vite/" },
      { text: "SSR / MPA 統合", link: "/vite/01-ssr" },
    ],
  },
  {
    text: "webpack / Next.js",
    items: [{ text: "セットアップ", link: "/webpack/" }],
  },
];

const enSidebar = [
  {
    text: "Getting Started",
    items: [
      { text: "Setup with Vite", link: "/en/vite/" },
      { text: "Setup with webpack / Next.js", link: "/en/webpack/" },
    ],
  },
  {
    text: "Core",
    items: [
      { text: "Overview", link: "/en/core/" },
      { text: "css`` Syntax", link: "/en/core/01-syntax" },
      { text: "How It Works", link: "/en/core/02-how-it-works" },
      {
        text: "Migrating from Tailwind / UnoCSS",
        link: "/en/core/03-migrate-from-utility-frameworks",
      },
      { text: "Editor & Toolchain", link: "/en/core/04-tooling" },
      { text: "CSS Variables & Design Tokens", link: "/en/core/05-css-variables" },
      { text: "Dynamic Styling Patterns", link: "/en/core/06-dynamic-styles" },
    ],
  },
  {
    text: "Vite Plugin",
    items: [
      { text: "Setup & Options", link: "/en/vite/" },
      { text: "SSR / MPA Integration", link: "/en/vite/01-ssr" },
    ],
  },
  {
    text: "webpack / Next.js",
    items: [{ text: "Setup", link: "/en/webpack/" }],
  },
];

export default defineConfig({
  title: "bestcss",
  base: BASE,
  markdown: {
    // 依存言語をすべて highlighter 作成時に渡す理由:
    // (1) css / scss — css.styled が source.css#property-names 等へ委譲して
    //     おり、未ロードだと include が解決されず css`` 内が単色になる
    // (2) ts / tsx / js / jsx — shiki の injection は grammar 生成時に
    //     一度だけ収集されるため、VitePress の遅延ロード（フェンス初出時に
    //     loadLanguageSync）では injection が適用されない（実測）。
    //     作成時に一緒に渡すことで injection 込みで grammar が組まれる
    languages: [
      ...cssLang,
      ...scssLang,
      ...jsLang,
      ...jsxLang,
      ...tsLang,
      ...tsxLang,
      cssStyledGrammar,
      styledInjectionGrammar,
    ],
  },
  // 同期スクリプト実行前でも設定ロードが失敗しないように
  ignoreDeadLinks: false,
  locales: {
    root: {
      label: "日本語",
      lang: "ja",
      description:
        "ゼロランタイム × コロケーション × 生 CSS 文法 × サイズ最適化の CSS ライブラリ",
      themeConfig: {
        nav: [
          { text: "ガイド", link: "/core/" },
          { text: "GitHub", link: "https://github.com/YutaUra/bestcss" },
        ],
        sidebar: jaSidebar,
        outline: { label: "このページ" },
      },
    },
    en: {
      label: "English",
      lang: "en",
      description:
        "A CSS library with zero runtime, colocation, plain CSS syntax, and size optimization — all at once",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/core/" },
          { text: "GitHub", link: "https://github.com/YutaUra/bestcss" },
        ],
        sidebar: enSidebar,
      },
    },
  },
  themeConfig: {
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "検索", buttonAriaLabel: "検索" },
              modal: {
                noResultsText: "見つかりませんでした",
                resetButtonTitle: "クリア",
                footer: { selectText: "選択", navigateText: "移動" },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/YutaUra/bestcss" },
      { icon: "npm", link: "https://www.npmjs.com/package/@bestcss/core" },
    ],
  },
});
