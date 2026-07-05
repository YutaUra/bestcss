import { defineConfig } from "vitepress";

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
