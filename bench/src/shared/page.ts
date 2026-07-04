/**
 * 3 システム（bestcss / tailwind / CSS Modules)で完全に同一の UI を
 * レンダリングするための共通インターフェース。
 * スタイリング手法の違いだけを比較するため、DOM 構造はここで固定する。
 */
export interface Ui {
  button(variant: "primary" | "secondary" | "danger", label: string): string;
  badge(kind: "info" | "success" | "warn", label: string): string;
  card(title: string, body: string, footer: string): string;
  input(id: string, label: string, placeholder: string): string;
  alert(kind: "info" | "error", text: string): string;
  row(cells: string[]): string;
  navLink(label: string, active: boolean): string;
  heading(level: 1 | 2, text: string): string;
  stackV(children: string[]): string;
  stackH(children: string[]): string;
}

const CARD_COUNT = 12;
const TABLE_ROWS = 20;

export function renderPage(ui: Ui): string {
  const nav = ui.stackH(
    ["Home", "Projects", "Reports", "Settings", "Help"].map((label, i) =>
      ui.navLink(label, i === 0),
    ),
  );

  const cards = Array.from({ length: CARD_COUNT }, (_, i) =>
    ui.card(
      `Project ${i + 1}`,
      `プロジェクト ${i + 1} の説明テキスト。進捗と状態を表示する。`,
      ui.stackH([
        ui.badge(
          i % 3 === 0 ? "success" : i % 3 === 1 ? "info" : "warn",
          i % 3 === 0 ? "active" : i % 3 === 1 ? "draft" : "paused",
        ),
        ui.button(i % 2 === 0 ? "primary" : "secondary", "開く"),
      ]),
    ),
  );

  const tableRows = Array.from({ length: TABLE_ROWS }, (_, i) =>
    ui.row([
      `#${1000 + i}`,
      `タスク ${i + 1}`,
      i % 4 === 0 ? "完了" : "進行中",
      `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
    ]),
  );

  const form = ui.stackV([
    ui.heading(2, "新規プロジェクト"),
    ui.input("name", "プロジェクト名", "例: bestcss"),
    ui.input("owner", "オーナー", "例: yutaura"),
    ui.input("deadline", "期限", "YYYY-MM-DD"),
    ui.alert("info", "作成後にメンバーを招待できます。"),
    ui.stackH([
      ui.button("primary", "作成"),
      ui.button("secondary", "キャンセル"),
      ui.button("danger", "破棄"),
    ]),
  ]);

  return [
    "<!doctype html><html><head><meta charset='utf-8'></head><body>",
    ui.stackV([
      ui.heading(1, "Dashboard"),
      nav,
      ui.stackH(cards.slice(0, 4)),
      ui.stackH(cards.slice(4, 8)),
      ui.stackH(cards.slice(8, 12)),
      ui.heading(2, "Tasks"),
      ui.stackV(tableRows),
      form,
    ]),
    "</body></html>",
  ].join("");
}
