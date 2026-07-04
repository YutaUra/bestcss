// styled.ts を JS としては import せず、抽出された CSS だけを取り込む。
// routeStyles の仮想スタイルエントリが生成するコードと同じ形
import "./styled.ts.bestcss.css";

export const lazy = true;
