# 動的なスタイルの 4 パターン

ゼロランタイムでは「実行時に CSS を生成する」という選択肢が存在しない。動的にできるのは、**ビルド時に抽出済みのスタイルのうち、どれを効かせるか**だけである。その「効かせ方」に 4 つのパターンがあり、どれを選んでもゼロランタイムは崩れない（css`` の中身はすべて静的で、実行時に変わるのはクラス名・属性・変数の値だけ）。

上から順に検討するとよい。番号が小さいほど JS の関与が少なく、壊れにくい。

## 1. 状態セレクタ — ブラウザが知っている状態は CSS に任せる

hover / disabled / focus のような状態は、JS で追跡してクラスを付け替えるのではなく、**状態セレクタで CSS 側に反応させる**:

```tsx
const button = css`
  background: var(--color-primary);

  &:hover {
    filter: brightness(1.1);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

<button className={button} disabled={isPending}>送信</button>;
```

`isPending` が変えるのは `disabled` 属性だけで、className は不変。ARIA 属性も同じように使える（`&[aria-expanded="true"] { ... }`）。見た目を ARIA にぶら下げると、**属性を付け忘れたときに見た目も壊れる**ため、アクセシビリティの漏れに開発中に気づけるという副次効果がある。

- **メリット**: JS の状態管理も再レンダーも不要。ハイドレーション前から動く（SSR の初期表示で hover が効く）。状態の定義がプラットフォーム標準
- **デメリット**: ブラウザ / DOM が知っている状態にしか使えない
- **使うべきとき**: `:hover` `:disabled` `:checked` `:invalid` `[aria-*]` など、**対応するセレクタが既に存在するなら常にこれ**。以降のパターンはセレクタが存在しない場合の手段

## 2. クラスの合成 — 有限のバリアントを切り替える

css`` の戻り値はただの文字列なので、条件分岐や [clsx](https://github.com/lukeed/clsx) で合成できる。各枝はビルド時にそれぞれ抽出される:

```tsx
import clsx from "clsx";

const base = css`
  padding: 8px 16px;
  border-radius: 6px;
`;
const primary = css`
  background: var(--color-primary);
`;
const danger = css`
  background: var(--color-danger);
`;

<button className={clsx(base, intent === "danger" ? danger : primary)} />;
```

- **メリット**: プレーンな TS なので型が効く（バリアント名の typo はコンパイルエラーにできる）。cva 等の variants ライブラリにもそのまま乗る
- **デメリット**: 同一プロパティが衝突すると、**勝敗は className の並びではなく CSS の出力順**で決まる。base と variant に同じプロパティを書かない、または `@layer` で決定的にする（[css`` の文法](./01-syntax.md) を参照）。状態の数だけクラスの組み合わせが増えるため、多数の要素が同じ状態に反応する UI では管理が散らばる
- **使うべきとき**: **見た目のバリエーションが有限**で、反応する要素が 1 つのとき（intent / size / tone のような variant 切り替え）

## 3. data 属性 — 1 つの状態に複数の要素が反応する

状態を DOM の data 属性に置き、css`` の中のセレクタで反応させる。className の付け替えが不要になり、**親の状態に子孫が反応できる**のがクラス合成との決定的な違い:

```tsx
const details = css`
  border: 1px solid transparent;

  &[data-state="open"] {
    border-color: var(--color-primary);
  }
`;

const icon = css`
  transition: transform 0.2s;

  /* 親の data-state に子が反応する。クラスを配って回る必要がない */
  [data-state="open"] & {
    transform: rotate(180deg);
  }
`;

<div className={details} data-state={isOpen ? "open" : "closed"}>
  <span className={icon}>▾</span>
  {children}
</div>;
```

- **メリット**: 状態の置き場が DOM の 1 箇所に集まり、複数のプロパティ・複数の子孫要素が同じ属性に反応できる。クラスが不変なので状態間の `transition` が自然に効く。DevTools で要素を見れば状態が読める。Radix UI など headless UI ライブラリは同じ規約（`data-state="open"` 等）を出力するため、**自前の状態管理なしでそのまま乗れる**
- **デメリット**: セレクタは静的なので、値は有限の列挙に限られる。属性値はただの文字列で、typo しても stylelint / TS は検出しない（`data-state={state}` の `state` を union 型にして JS 側で縛ると緩和できる）
- **使うべきとき**: **1 つの状態に複数のプロパティや子孫要素が反応する**とき（開閉、選択、ドラッグ中など）。headless UI ライブラリと組むとき

## 4. style + CSS 変数 — 値が連続的・無限のとき

進捗率・座標・ユーザー入力の色のように**取りうる値が列挙できない**場合は、これが唯一の手段。CSS 変数を style 属性から注入する:

```tsx
const bar = css`
  width: var(--progress, 0%);
  background: var(--color-primary);
  transition: width 0.2s;
`;

<div
  className={bar}
  style={{ "--progress": `${percent}%` } as React.CSSProperties}
/>;
```

- **メリット**: 値空間が無限でも CSS は 1 ルールのまま増えない。値の更新にクラスの付け替えが伴わないため、ドラッグやアニメーションのような高頻度更新に強い
- **デメリット**: 値が JS 側にあるため、stylelint のトークン検査（[CSS 変数とデザイントークン](./05-css-variables.md)）の対象外になる。注入漏れに備えてフォールバック（`var(--progress, 0%)`）を必ず書く。有限の選択肢しかない値にまで使うと、パターン 2 / 3 なら得られたはずの検査や可読性を失う
- **使うべきとき**: **値が連続的・無限**のときだけ。有限なら 2 か 3 に倒す

## 使い分けの早見表

| 状況 | パターン |
|------|---------|
| ブラウザ / DOM がその状態を既に知っている（hover, disabled, checked, aria-*） | 1. 状態セレクタ |
| 有限のバリエーションを、1 つの要素で切り替える | 2. クラス合成 |
| 有限の状態に、複数のプロパティや子孫要素が反応する | 3. data 属性 |
| 値が連続的・無限（進捗、座標、任意の色） | 4. CSS 変数 |

迷ったら「その状態、ブラウザが既に知らないか？ → 起こりうる値は列挙できるか？ → 反応する要素は 1 つか？」の順に問うと、上の表に落ちる。

## 関連ページ

- `${}` 補間が禁止される理由 → [css`` の文法](./01-syntax.md)
- CSS 変数のトークン運用と typo 検出 → [CSS 変数とデザイントークン](./05-css-variables.md)
