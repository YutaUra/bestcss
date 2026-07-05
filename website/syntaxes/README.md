# syntaxes/

[vscode-styled-components](https://github.com/styled-components/vscode-styled-components)（MIT License）の TextMate 文法を vendor したもの。

サイトのコードブロック（Shiki）で、ts / tsx 内の css`` テンプレートリテラルを
CSS としてシンタックスハイライトするために使う（.vitepress/config.ts で
injection grammar として登録している）。

npm 依存にしない理由: この文法は VS Code 拡張としてのみ配布されており、
文法 JSON だけを提供する npm パッケージが存在しないため。
