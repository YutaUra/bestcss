/**
 * css`` タグ。ビルド時に変換で消えるため、ランタイムでは決して実行されない。
 *
 * values を never[] にしている理由: `${}` 補間を型レベルでも拒否し、
 * ビルドエラーより手前（エディタ上）で気付けるようにするため。
 */
export function css(_strings: TemplateStringsArray, ..._values: never[]): string {
  throw new Error(
    "best-css: css`` が実行時に呼ばれました。" +
      "ビルド時に変換されるはずなので、@bestcss/vite-plugin が設定されているか確認してください。",
  );
}
