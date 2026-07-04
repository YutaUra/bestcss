import { css } from "@best-css/core";

const layout = css`
  display: grid;
  place-items: center;
  min-height: 100dvh;
  font-family: system-ui, sans-serif;
`;

const title = css`
  font-size: 2rem;
  color: var(--brand);
  animation: pulse 2s ease-in-out infinite;
`;

const button = css`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: royalblue;
  color: white;
  font-size: 1rem;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

export const App = () => {
  return (
    <main className={layout}>
      <div>
        <h1 className={title}>best-css example</h1>
        <button type="button" className={button}>
          Hover me
        </button>
      </div>
    </main>
  );
};
