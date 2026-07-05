import { transform as transformCss } from "lightningcss";

/**
 * CSS を minify する。ルート単位 CSS 分割でプラグインが自前 emit する
 * アセットは Vite の CSS パイプライン（cssMinify）を通らないため、
 * 同じ Lightning CSS でここで最小化する
 */
export function minifyCss(css: string): string {
  const result = transformCss({
    filename: "bestcss-minify.css",
    code: Buffer.from(css),
    minify: true,
  });
  return result.code.toString();
}
