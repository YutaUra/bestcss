import { css } from "@bestcss/core";
import { fromUtilities } from "./util.js";

// utilities のブロックがバンドル上「先」に現れるよう、entry 側で
// components を後から使う（出現順ではなく layers 設定順で勝敗が
// 決まることを検証するための並び）
export const component = css`
  @layer components {
    padding: 111px;
  }
`;

export const all = [component, fromUtilities];
