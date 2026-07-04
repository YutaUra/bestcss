import { css } from "@bestcss/core";
import type { Child } from "hono/jsx";

const layout = css`
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px;
  font-family: system-ui, sans-serif;
`;

const nav = css`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
`;

const navLink = css`
  color: #2563eb;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const title = css`
  font-size: 2rem;
  color: #2563eb;
`;

export const Layout = (props: { children: Child }) => (
  <main class={layout}>
    <nav class={nav}>
      <a class={navLink} href="/">
        Home
      </a>
      <a class={navLink} href="/about">
        About
      </a>
    </nav>
    {props.children}
  </main>
);

export const Title = (props: { children: Child }) => (
  <h1 class={title}>{props.children}</h1>
);
