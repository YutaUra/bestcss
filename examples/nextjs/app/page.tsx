import { css } from "@best-css/core";

const layout = css`
  display: grid;
  place-items: center;
  min-height: 100dvh;
  font-family: system-ui, sans-serif;
`;

const title = css`
  font-size: 2rem;
  color: #2563eb;
`;

export default function Home() {
  return (
    <main className={layout}>
      <h1 className={title}>best-css × Next.js (Turbopack)</h1>
    </main>
  );
}
