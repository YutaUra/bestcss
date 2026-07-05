import { css } from "@bestcss/core";

// アプリ側と同一内容（内容ハッシュ収束・重複排除の検証用）
export const shared = css`
  gap: 9px;
`;

// ライブラリ固有のスタイル
export const libOnly = css`
  border-radius: 7px;
`;
