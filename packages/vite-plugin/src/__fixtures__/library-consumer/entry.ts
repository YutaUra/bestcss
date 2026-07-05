import "fake-ui/style.css";
import { libOnly, shared } from "fake-ui";
import { css } from "@bestcss/core";

// fake-ui の shared と同一内容 → 同一クラス名に収束し重複排除される
const appShared = css`
  gap: 9px;
`;

const appOnly = css`
  padding: 5px;
`;

export const classNames = [shared, libOnly, appShared, appOnly];
