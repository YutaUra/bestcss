import { css } from "@best-css/core";
import type { Ui } from "../shared/page.js";

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
`;
const buttonPrimary = css`
  background: #2563eb;
  color: #fff;
`;
const buttonSecondary = css`
  background: #f3f4f6;
  color: #111827;
`;
const buttonDanger = css`
  background: #dc2626;
  color: #fff;
`;

const badgeBase = css`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
`;
const badgeInfo = css`
  background: #dbeafe;
  color: #1e40af;
`;
const badgeSuccess = css`
  background: #dcfce7;
  color: #166534;
`;
const badgeWarn = css`
  background: #fef9c3;
  color: #854d0e;
`;

const card = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
`;
const cardTitle = css`
  font-size: 16px;
  font-weight: 600;
`;
const cardBody = css`
  font-size: 14px;
  color: #4b5563;
`;

const field = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const fieldLabel = css`
  font-size: 14px;
  font-weight: 500;
  color: #374151;
`;
const fieldInput = css`
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
`;

const alertBase = css`
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
`;
const alertInfo = css`
  background: #eff6ff;
  color: #1e40af;
`;
const alertError = css`
  background: #fef2f2;
  color: #991b1b;
`;

const tableRow = css`
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
`;
const tableCell = css`
  flex: 1;
`;

const navLinkBase = css`
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
`;
const navLinkActive = css`
  background: #111827;
  color: #fff;
`;
const navLinkInactive = css`
  color: #4b5563;
`;

const heading1 = css`
  font-size: 24px;
  font-weight: 700;
`;
const heading2 = css`
  font-size: 18px;
  font-weight: 600;
`;

const stackV = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const stackH = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
`;

const BUTTON_VARIANTS = {
  primary: buttonPrimary,
  secondary: buttonSecondary,
  danger: buttonDanger,
} as const;

const BADGE_KINDS = {
  info: badgeInfo,
  success: badgeSuccess,
  warn: badgeWarn,
} as const;

export const ui: Ui = {
  button: (variant, label) =>
    `<button class="${buttonBase} ${BUTTON_VARIANTS[variant]}">${label}</button>`,
  badge: (kind, label) =>
    `<span class="${badgeBase} ${BADGE_KINDS[kind]}">${label}</span>`,
  card: (title, body, footer) =>
    `<div class="${card}"><div class="${cardTitle}">${title}</div><div class="${cardBody}">${body}</div>${footer}</div>`,
  input: (id, label, placeholder) =>
    `<div class="${field}"><label class="${fieldLabel}" for="${id}">${label}</label><input class="${fieldInput}" id="${id}" placeholder="${placeholder}"></div>`,
  alert: (kind, text) =>
    `<div class="${alertBase} ${kind === "info" ? alertInfo : alertError}">${text}</div>`,
  row: (cells) =>
    `<div class="${tableRow}">${cells.map((c) => `<div class="${tableCell}">${c}</div>`).join("")}</div>`,
  navLink: (label, active) =>
    `<a class="${navLinkBase} ${active ? navLinkActive : navLinkInactive}" href="#">${label}</a>`,
  heading: (level, text) =>
    level === 1
      ? `<h1 class="${heading1}">${text}</h1>`
      : `<h2 class="${heading2}">${text}</h2>`,
  stackV: (children) => `<div class="${stackV}">${children.join("")}</div>`,
  stackH: (children) => `<div class="${stackH}">${children.join("")}</div>`,
};
