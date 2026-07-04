import { css } from "@bestcss/core";
import { useState } from "hono/jsx";

const button = css`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #2563eb;
  color: white;
  font-size: 1rem;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" class={button} onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
