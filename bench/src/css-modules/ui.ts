import type { Ui } from "../shared/page.js";
import s from "./ui.module.css";

const BUTTON_VARIANTS = {
  primary: s["buttonPrimary"],
  secondary: s["buttonSecondary"],
  danger: s["buttonDanger"],
} as const;

const BADGE_KINDS = {
  info: s["badgeInfo"],
  success: s["badgeSuccess"],
  warn: s["badgeWarn"],
} as const;

export const ui: Ui = {
  button: (variant, label) =>
    `<button class="${s["buttonBase"]} ${BUTTON_VARIANTS[variant]}">${label}</button>`,
  badge: (kind, label) =>
    `<span class="${s["badgeBase"]} ${BADGE_KINDS[kind]}">${label}</span>`,
  card: (title, body, footer) =>
    `<div class="${s["card"]}"><div class="${s["cardTitle"]}">${title}</div><div class="${s["cardBody"]}">${body}</div>${footer}</div>`,
  input: (id, label, placeholder) =>
    `<div class="${s["field"]}"><label class="${s["fieldLabel"]}" for="${id}">${label}</label><input class="${s["fieldInput"]}" id="${id}" placeholder="${placeholder}"></div>`,
  alert: (kind, text) =>
    `<div class="${s["alertBase"]} ${kind === "info" ? s["alertInfo"] : s["alertError"]}">${text}</div>`,
  row: (cells) =>
    `<div class="${s["tableRow"]}">${cells.map((c) => `<div class="${s["tableCell"]}">${c}</div>`).join("")}</div>`,
  navLink: (label, active) =>
    `<a class="${s["navLinkBase"]} ${active ? s["navLinkActive"] : s["navLinkInactive"]}" href="#">${label}</a>`,
  heading: (level, text) =>
    level === 1
      ? `<h1 class="${s["heading1"]}">${text}</h1>`
      : `<h2 class="${s["heading2"]}">${text}</h2>`,
  stackV: (children) => `<div class="${s["stackV"]}">${children.join("")}</div>`,
  stackH: (children) => `<div class="${s["stackH"]}">${children.join("")}</div>`,
};
