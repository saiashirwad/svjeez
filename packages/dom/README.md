# @svjeez/dom

Turns real HTML and CSS into svjeez nodes you can animate. Chromium lays the markup out, and `@svjeez/dom` reads every box, border, shadow, text line and inline icon back as SVG. It works the same whatever made the markup: React, Svelte, plain HTML, or a page in a running app.

```tsx
import { Dom, fill, render, snap, snapshots } from "@svjeez/dom";

// A flow is an async generator. Sub-flows compose with yield*.
async function* login(email: string) {
  yield fill("input[type=email]", email);
  yield snap("typed", span(0.5, 1)); // when the timeline arrives here
}

async function* flow() {
  yield snap("idle");
  yield* login("sai@example.com");
  yield render(failedMarkup);
  yield snap("failed", { at: 3, over: 0.7, ease: ease.pop });
  yield snap("idle", span(5, 0.6)); // names may repeat
}

// A live page per card: typed text, focus and hover carry from one instruction to the next.
const steps = await snapshots("snapshots.json", { fonts: [geist] }, async (dom) =>
  (await dom.mount(markup, { css })).run(flow()),
);

<Dom states={steps} fonts={[geist]} parts={{ submit: press }} />
```

- `browser(options)` is the lower level: `await using dom = await browser({ fonts })`, then `dom.mount(html, { css, width, pad, parts })` or `dom.open(url, { root, ... })` for a running app. Both give a card, one open page.
- `card.run(flow)` runs a flow on the card's page and resolves to one step per `snap`, in order, for `<Dom states>`. Instructions are `snap(name?, timing?)`, `fill(selector, text)`, `click`, `hover`, `press(key)`, `move(x, y)`, `render(html)` and `act((page) => ...)` for anything else Playwright does. All but `act` are plain objects, so a flow can also be a list, the way Playwright's codegen writes it: `[{ snap: "idle" }, { fill: ["input", "sai@example.com"] }, { snap: "typed", at: 0.5, over: 1 }]`. `find(steps, name)` gets a snapshot back by name. `card.snap(action?)` reads one state at a time.
- A snapshot is plain JSON: `{ name?, width, height, pad, box, root }`. Colors that differ between the light and dark scheme are stored as `{ light, dark }`, so the drawing follows the viewer's scheme. `schemes` picks one scheme instead, and `dark: { class }` is the class the dark pass adds to `<html>` (default `dark`).
- An element is a part when it has `data-part="name"` or matches `parts.name`. `<Dom parts>` animates parts, and `rect(snapshot, part)` says where one landed.
- `<Dom states>` takes one snapshot, drawn as is, or several that each turn into the next. A step is a snapshot, or `[snapshot, span]` or `[snapshot, span, ease]` for when the timeline arrives at it from the previous one, which is what a snap with timing gives; otherwise `at[i]` starts the move into `states[i + 1]` and it runs `over` seconds.
- Elements pair across states by `data-key`, else part, else tag in sibling order, preferring siblings whose text matches, so a `<div>` inserted before another doesn't take its place. Classes don't count, so a class change morphs. `pair` overrides it. Paired boxes reshape and recolor, text and icons slide, and the rest fade.
- Changed text animates by what changed. Text that grows from or shrinks to the other types in or deletes one character at a time, with a caret, and a field's placeholder leaves at the first keystroke. Text that differs only in one number counts to it. Anything else crossfades.
- `snapshots(file, options, run)` records what each card was opened with, every data instruction, and every snapshot. Later builds run `run` again against the recording, so timing changes never need Chromium; anything else new (markup, a fill, a step) reads the pages again. Put what the recording can't see in `inputs`: an `act` function's body, the app behind `open()`, a theme a CSS function reads. A new package version or `SVJEEZ_DOM_REFRESH=1` reads again too.
- Not drawn yet: gradients, rotated or scaled elements, `::before` and `::after`, `z-index`.

Needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.
