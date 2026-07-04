import type { Ui } from "../shared/page.js";
import "./tw.css";

const BUTTON_BASE =
  "inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium border-none cursor-pointer";
const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white",
  secondary: "bg-gray-100 text-gray-900",
  danger: "bg-red-600 text-white",
} as const;

const BADGE_BASE =
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
const BADGE_KINDS = {
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warn: "bg-yellow-100 text-yellow-800",
} as const;

export const ui: Ui = {
  button: (variant, label) =>
    `<button class="${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}">${label}</button>`,
  badge: (kind, label) =>
    `<span class="${BADGE_BASE} ${BADGE_KINDS[kind]}">${label}</span>`,
  card: (title, body, footer) =>
    `<div class="flex flex-col gap-2 bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><div class="text-base font-semibold">${title}</div><div class="text-sm text-gray-600">${body}</div>${footer}</div>`,
  input: (id, label, placeholder) =>
    `<div class="flex flex-col gap-1"><label class="text-sm font-medium text-gray-700" for="${id}">${label}</label><input class="px-3 py-2 border border-gray-300 rounded-md text-sm" id="${id}" placeholder="${placeholder}"></div>`,
  alert: (kind, text) =>
    `<div class="p-3 rounded-md text-sm ${kind === "info" ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-800"}">${text}</div>`,
  row: (cells) =>
    `<div class="flex gap-4 px-3 py-2 border-b border-gray-200 text-sm">${cells.map((c) => `<div class="flex-1">${c}</div>`).join("")}</div>`,
  navLink: (label, active) =>
    `<a class="px-3 py-1.5 rounded-md text-sm ${active ? "bg-gray-900 text-white" : "text-gray-600"}" href="#">${label}</a>`,
  heading: (level, text) =>
    level === 1
      ? `<h1 class="text-2xl font-bold">${text}</h1>`
      : `<h2 class="text-lg font-semibold">${text}</h2>`,
  stackV: (children) =>
    `<div class="flex flex-col gap-4">${children.join("")}</div>`,
  stackH: (children) =>
    `<div class="flex flex-wrap items-center gap-4">${children.join("")}</div>`,
};
