# サイズベンチマーク結果

実行日: unknown-date

同一の UI（ダッシュボード: ナビ + カード x12 + テーブル 20 行 + フォーム）を
3 手法で構築し、実際の Vite ビルドを通した出力を計測した。単位はバイト。

| 手法 | HTML | HTML gz | class属性 | CSS | CSS gz | 合計 gz |
|---:|---:|---:|---:|---:|---:|---:|
| bestcss | 6,717 | 993 | 1,875 | 1,400 | 499 | 1,492 |
| css-modules | 11,004 | 1,228 | 6,162 | 1,863 | 679 | 1,907 |
| tailwind | 13,827 | 1,342 | 8,985 | 6,010 | 1,574 | 2,916 |

## 計測条件

- Vite lib ビルド（minify / cssMinify 有効）の出力 JS を実行して HTML を生成
- 「class属性」は HTML 中の `class="..."` の合計バイト数（手法が HTML に課すコスト）
- tailwind は preflight（リセット CSS）を除外し theme + utilities のみ
  （他手法もリセットを持たないため、手法自体の出力サイズだけを比較する）
- コーパス定義: [bench/src](src)
