import { css } from "@bestcss/core";
import type { Child } from "hono/jsx";

// admin ルートでしか使わないスタイル。
// routeStyles により admin 用の CSS ファイルにだけ出力される
const panel = css`
  border: 4px dashed #dc2626;
  border-radius: 8px;
  padding: 24px;
  background: #fef2f2;
`;

export const AdminPanel = (props: { children: Child }) => (
  <section class={panel}>{props.children}</section>
);
