# The 4 Patterns of Dynamic Styling

With zero runtime, "generate CSS at runtime" is not an option. The only thing that can be dynamic is **which of the build-time-extracted styles take effect**. There are 4 patterns for that, and none of them break zero-runtime (css`` contents are always static; only class names, attributes, and variable values change at runtime).

Consider them in order — the lower the number, the less JS is involved and the harder it is to break.

## 1. State selectors — leave browser-known states to CSS

For states like hover / disabled / focus, don't track them in JS and swap classes — **let CSS react through state selectors**:

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

<button className={button} disabled={isPending}>Submit</button>;
```

`isPending` only changes the `disabled` attribute; className never changes. ARIA attributes work the same way (`&[aria-expanded="true"] { ... }`). Hanging appearance off ARIA has a nice side effect: **forget the attribute and the styling visibly breaks**, so accessibility gaps surface during development.

- **Pros**: no JS state, no re-renders. Works before hydration (hover works on SSR'd initial paint). State definitions are platform-standard
- **Cons**: only works for states the browser / DOM already knows
- **When to use**: whenever a selector already exists — `:hover` `:disabled` `:checked` `:invalid` `[aria-*]`. **Always prefer this**; the patterns below are for when no selector exists

## 2. Class composition — switching between finite variants

css`` returns a plain string, so you can branch and compose with [clsx](https://github.com/lukeed/clsx). Each branch is extracted at build time:

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

- **Pros**: plain TypeScript, so types apply (a typo'd variant name is a compile error). Rides variants libraries like cva as-is
- **Cons**: when the same property conflicts, **the winner is decided by stylesheet output order, not className order**. Don't write the same property in base and variant, or make it deterministic with `@layer` (see [css`` syntax](/en/core/01-syntax)). Class combinations multiply with state count, so UIs where many elements react to one state get scattered
- **When to use**: a **finite set of looks** on a single element (intent / size / tone variants)

## 3. data attributes — one state, many reacting elements

Put the state on a DOM data attribute and react to it with selectors inside css``. No class swapping — and unlike class composition, **descendants can react to a parent's state**:

```tsx
const details = css`
  border: 1px solid transparent;

  &[data-state="open"] {
    border-color: var(--color-primary);
  }
`;

const icon = css`
  transition: transform 0.2s;

  /* child reacts to the parent's data-state — no passing classes around */
  [data-state="open"] & {
    transform: rotate(180deg);
  }
`;

<div className={details} data-state={isOpen ? "open" : "closed"}>
  <span className={icon}>▾</span>
  {children}
</div>;
```

- **Pros**: the state lives in one place in the DOM, and multiple properties / descendant elements react to the same attribute. Classes stay constant, so `transition` between states just works. DevTools shows the state on the element. Headless UI libraries like Radix UI emit the same convention (`data-state="open"` etc.), so **you can ride them with no state management of your own**
- **Cons**: selectors are static, so values are limited to a finite enum. Attribute values are plain strings — typos aren't caught by stylelint / TS (mitigate by typing the `state` in `data-state={state}` as a union on the JS side)
- **When to use**: when **multiple properties or descendants react to one state** (open/closed, selected, dragging). When pairing with headless UI libraries

## 4. style + CSS variables — for continuous, unbounded values

When the value can't be enumerated — progress, coordinates, a user-picked color — this is the only option. Inject a CSS variable via the style attribute:

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

- **Pros**: an infinite value space with a single CSS rule. Value updates involve no class swapping, so it holds up under high-frequency updates like dragging and animation
- **Cons**: the value lives in JS, outside stylelint's token checking ([CSS Variables & Design Tokens](/en/core/05-css-variables)). Always write a fallback (`var(--progress, 0%)`) in case injection is missed. Using it for values with finite options throws away the checks and readability patterns 2 / 3 would have given you
- **When to use**: **only when the value is continuous / unbounded**. If it's finite, fall back to 2 or 3

## Quick reference

| Situation | Pattern |
|-----------|---------|
| The browser / DOM already knows the state (hover, disabled, checked, aria-*) | 1. State selectors |
| A finite set of looks, switched on a single element | 2. Class composition |
| A finite state that multiple properties or descendants react to | 3. data attributes |
| Continuous / unbounded values (progress, coordinates, arbitrary colors) | 4. CSS variables |

When unsure, ask in order: "Does the browser already know this state? → Can the values be enumerated? → Does only one element react?" — the answers land you in the table above.

## Related pages

- Why `${}` interpolation is forbidden → [css`` syntax](/en/core/01-syntax)
- Token discipline and typo detection for CSS variables → [CSS Variables & Design Tokens](/en/core/05-css-variables)
