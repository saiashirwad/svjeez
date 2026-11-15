# @svjeez/dom

Turns real HTML and CSS into svjeez nodes you can animate. Chromium lays the markup out, and `@svjeez/dom` reads every box, border, shadow, text line and inline icon back as SVG. It works the same whatever made the markup: React, Svelte, plain HTML, or a page in a running app.

```tsx
import { Dom, duration, fill, html, size, snap, snapshots, wait } from "@svjeez/dom";
import { ease, render } from "svjeez";

// A flow is a list. A sub-flow is a function that returns one, spread in.
const login = (email: string) => [fill("email", email), snap("typed", { over: 1 })];

const flow = [
  snap("idle"), // the clock starts here, at 0
  wait(0.5),
  ...login("sai@example.com"), // moves in from the cursor, over 1s
  html(failedMarkup), // re-render; hover and focus don't carry over
  snap("failed", { over: 0.7, ease: ease.pop }),
  wait(1.5),
  snap("idle"), // names may repeat; 0.6s by default
];

// A live page per flow: typed text, focus and hover carry from one instruction to the next.
const steps = await snapshots("snapshots.json", { fonts: [geist], css }, (dom) => dom.run(markup, flow));

render({ ...size(steps), duration: duration(steps) }, <Dom states={steps} fonts={[geist]} />);
```

- Time is relative. The first `snap` holds from 0; each later one moves in from the cursor over `over` seconds (default 0.6) and leaves the cursor at its end, and `wait(s)` pushes it on. `duration(steps)` is where it ends. To start a flow later, wrap the `<Dom>` in `<Clip at>`.
- `dom.run(html, flow, options?)` mounts the markup, runs the flow and closes the page; `dom.run({ url, root }, flow)` does the same on a running app. `browser(options)` is the lower level: `await using dom = await browser({ fonts, css })`, then `dom.mount(html, { css, width, pad, parts, root })` or `dom.open(url, { root, ... })` give a card, one open page, with `card.run(flow)`, `card.snap(action?)`, `card.html(markup)` and `card.close()`. `css` given to `browser()` or `snapshots()` applies to every mount; a mount's own `css` overrides it.
- Instructions are `snap(name?, { over, ease }?)`, `wait(s)`, `fill(target, text)`, `click(target)`, `hover(target)`, `press(key)`, `move(x, y)`, `html(markup)` and `act((page) => ...)` for anything else Playwright does. A target is a part name, else a CSS selector. All but `act` are plain objects, so a flow can be written as data: `[{ snap: "idle" }, { fill: ["email", "sai@example.com"] }, { snap: "typed", over: 1 }]`. `card.run` resolves to one step per `snap` and `wait`; `find(steps, name)` gets a snapshot back by name.
- A snapshot is plain JSON: `{ name?, width, height, pad, box, root }`. Colors that differ between the light and dark scheme are stored as `{ light, dark }`, so the drawing follows the viewer's scheme. `schemes` picks one scheme instead, and `dark: { class }` is the class the dark pass adds to `<html>` (default `dark`).
- An element is a part when it has `data-part="name"` or matches `parts.name`. `<Dom parts>` animates parts, and `rect(snapshot, part, index?)` says where one landed.
- `<Dom states>` takes one snapshot, drawn as is, or steps: snapshots, `[snapshot, { over, ease }]` and `{ wait }`, as `card.run` gives them or written by hand. `size(states)` is the picture's size. `ease` is for moves without one (default `ease.inOut`), `text` animates each line of a single snapshot, and `x`, `y` and `animation` place and move the whole drawing.
- Elements pair across states by `data-key`, else part, else tag in sibling order, preferring siblings whose text matches, so a `<div>` inserted before another doesn't take its place. Classes don't count, so a class change morphs. `pair` overrides it. Paired boxes reshape and recolor, text and icons slide, and the rest fade.
- Changed text animates by what changed. Text that grows from or shrinks to the other types in or deletes one character at a time, with a caret, and a field's placeholder leaves at the first keystroke. Text that differs only in one number counts to it. Anything else crossfades.
- `snapshots(file, options, run)` records what each card was opened with, every data instruction, and every snapshot. Later builds run `run` again against the recording, so timing changes never need Chromium; anything else new (markup, a fill, a step) reads the pages again. Put what the recording can't see in `inputs`: an `act` function's body, the app behind `open()`, a theme a CSS function reads. A new package version or `SVJEEZ_DOM_REFRESH=1` reads again too.
- A page's own web fonts come along: every `@font-face` file its text loaded is fetched, a WOFF or WOFF2 is unwrapped into its TTF, and `<Dom>` embeds only the characters it draws, unless `fonts` covers that family. `snapshots()` stores each file once, brotli-compressed. A face added from script, or from a stylesheet the page can't read, draws in a fallback.
- Live apps: `dom.open(url, { root, ready, width, height })` waits for `ready` before anything runs. A read waits for the DOM to go quiet, so results that arrive from script are in it. `z-index` and fixed elements paint in stacking order, `rotate`, `scale` and `transform` are drawn as matrices (a changed one crossfades), and inset shadows are drawn.
- A blurred `box-shadow`, outer or inset, is drawn as nine gradient-filled pieces that follow the blur's falloff, not through a filter, so it stays smooth and cheap however far the picture is zoomed.
- `linear-gradient` and `radial-gradient` layers (repeating ones too) are drawn as SVG gradients that ride along with their box. `::before` and `::after` are read where Chromium laid them out, through the DevTools protocol, and drawn as boxes named `::before` and `::after` with their text. A see-through fill under `backdrop-filter: blur()` is drawn more solid instead of blurred.
- Text that leaves one element and arrives in another, saying the same thing in nearly the same place (an app swapping its editor for the rendered text), stays put instead of fading.
- A `::before` or `::after` draws the text Chromium laid out for it, so counters and `attr()` come along, and a color input draws its value in its swatch.
- Not drawn yet: range inputs' tracks and thumbs, conic gradients, `background-size` tiles, background images, and clips between an element with a `z-index` and its stacking context.

## Stories

An app written as `update` and `view` (Elm, Redux, `@svjeez/live`) can be filmed by the messages it takes. `story` from `@svjeez/dom/story` runs them through `update`, renders each model with `view`, and gives back the first markup and a flow for `dom.run`:

```ts
import { given, message, story, timed } from "@svjeez/dom/story";

const { html, flow } = await story(
  { update, view, resolve }, // view: model => HTML, from any framework
  [
    given(start, cmds),
    message({ type: "select", key }),
    timed(message({ type: "set", key, value: 34 }), { over: 1, hold: 0.5 }),
    message({ type: "undo" }),
  ],
  { hold: 0.6 }, // the default for every beat
);

const steps = await snapshots(file, { css }, (dom) => dom.run(html, flow));
```

- `update(model, msg)` returns `[model, commands]`. `resolve(cmd, model)` answers a command with the messages the runtime would send back (a compile finished, a picture shown), and those go through `update` too, so one beat shows a message with all it led to.
- Each beat whose view changed is an `html()` and a `snap()`; one that changed nothing on screen adds no time. `timed(beat, { over, ease, hold })` sets its move and the wait after it, and `{ wait }` is a beat too.
- Nothing needs a hand-added key: elements pair by tag and order as usual, so a number that changes counts, and a class or attribute change morphs. `examples/live-story` films the scene editor this way, with `@svjeez/react`'s components.

The snapshot's types (`Snapshot`, `Box`, `TextRun`, `Item`, `Paint` and the rest) are exported for reading one by hand.

Needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.
