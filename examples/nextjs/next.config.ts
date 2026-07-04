import type { NextConfig } from "next";

// Turbopack は matchResource（!=!）を解釈しないため、query 方式で統合する:
// 1. *.tsx をメイン loader（importStyle: "query"）で変換。css`` はクラス名になり、
//    "./page.tsx?bestcss" のような自分自身へのクエリ付き import が追記される
// 2. query が bestcss のリクエストは css loader + as: "*.css" で
//    「抽出 CSS」として Next.js の CSS パイプラインに乗せる
const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    rules: {
      "*.tsx": {
        condition: {
          all: [{ not: "foreign" }, { not: { query: /bestcss/ } }],
        },
        loaders: [
          {
            loader: "@bestcss/webpack-loader",
            options: { importStyle: "query" },
          },
        ],
      },
      "*": {
        condition: { all: [{ not: "foreign" }, { query: /bestcss/ }] },
        loaders: ["@bestcss/webpack-loader/css"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
