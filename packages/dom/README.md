# @svjeez/dom

Turns real HTML and CSS into svjeez nodes you can animate. Chromium lays the markup out, and `@svjeez/dom` reads every box, border, shadow, text line and inline icon back as SVG. It works the same whatever made the markup: React, Svelte, plain HTML, or a page in a running app.

```tsx
import { Dom, snapshots } from "@svjeez/dom";

// A live page per card. Read it, act on it, read it again: typed text, focus and hover carry over.
const { idle, typed, failed } = await snapshots(
  "snapshots.json", // kept as JSON, so a build without changes never starts Chromium
  { inputs: [markup, css], fonts: [geist] }, // what the result depends on
  async (dom) => {
    const card = await dom.mount(markup, { css });

    // Each step runs on the same page, in order: null just reads it, html renders first.
    return card.steps({
      idle: null,
      typed: (page) => page.fill("input", "sai@example.com"),
      failed: { html: failedMarkup },
    });
  },
);

<Dom states={[idle, typed, [failed, span(3, 0.7)]]} fonts={[geist]} at={[1]} parts={{ submit: press }} />
```

- `browser(options)` is the lower level: `await using dom = await browser({ fonts })`, then `dom.mount(html, { css, width, pad, parts })` or `dom.open(url, { root, ... })` for a running app. Both give a card, one open page.
- `card.steps(spec)` runs named steps in order and resolves to snapshots under the same names, in the same order. A step is `null` (read the page), an action `(page) => ...`, or `{ html, action }`. It also takes the steps as plain data, the way Playwright's codegen writes them: `[{ snap: "idle" }, { fill: ["input", "sai@example.com"] }, { snap: "typed" }]`, with `click`, `hover`, `press`, `move: [x, y]` and `render: html` too. Data can go into `inputs`, so changing a step reads the page again. `card.snap(action?)` reads one state at a time.
- A snapshot is plain JSON: `{ width, height, pad, box, root }`. Colors that differ between the light and dark scheme are stored as `{ light, dark }`, so the drawing follows the viewer's scheme. `schemes` picks one scheme instead, and `dark: { class }` is the class the dark pass adds to `<html>` (default `dark`).
- An element is a part when it has `data-part="name"` or matches `parts.name`. `<Dom parts>` animates parts, and `rect(snapshot, part)` says where one landed.
- `<Dom states>` takes one snapshot, drawn as is, or several that each turn into the next. A step is a snapshot, or `[snapshot, span]` or `[snapshot, span, ease]` for when the timeline arrives at it from the previous one; otherwise `at[i]` starts the move into `states[i + 1]` and it runs `over` seconds.
- Elements pair across states by `data-key`, else part, else tag in sibling order, preferring siblings whose text matches, so a `<div>` inserted before another doesn't take its place. Classes don't count, so a class change morphs. `pair` overrides it. Paired boxes reshape and recolor, text and icons slide, and the rest fade.
- Changed text animates by what changed. Text that grows from or shrinks to the other types in or deletes one character at a time, with a caret, and a field's placeholder leaves at the first keystroke. Text that differs only in one number counts to it. Anything else crossfades.
- `snapshots()` reads again when `inputs` or this package's version changes. `SVJEEZ_DOM_REFRESH=1` forces it.
- Not drawn yet: gradients, rotated or scaled elements, `::before` and `::after`, `z-index`.

Needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.
