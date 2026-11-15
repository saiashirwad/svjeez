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
- `loop(steps, { over, ease, wait }?)` ends a flow where it began: it adds a move back into the first snapshot (default 0.6s, then an optional wait), so `duration()` and `<Dom>` include the way back and the picture loops without a jump. The return pairs like any move, so typed text deletes back.
- `snapshots(file, options, run)` records what each card was opened with, every data instruction, and every snapshot. Later builds run `run` again against the recording, so timing changes never need Chromium; anything else new (markup, a fill, a step) reads the pages again. Put what the recording can't see in `inputs`: an `act` function's body, the app behind `open()`, a theme a CSS function reads. A new package version or `SVJEEZ_DOM_REFRESH=1` reads again too.
- A page's own web fonts come along: every `@font-face` file its text loaded is fetched, a WOFF or WOFF2 is unwrapped into its TTF, and `<Dom>` embeds only the characters it draws, unless `fonts` covers that family. `snapshots()` stores each file once, brotli-compressed. A face added from script, or from a stylesheet the page can't read, draws in a fallback.
- Live apps: `dom.open(url, { root, ready, width, height })` waits for `ready` before anything runs. A read waits for the DOM to go quiet, so results that arrive from script are in it. `z-index` and fixed elements paint in stacking order, `rotate`, `scale` and `transform` are drawn as matrices (a changed one crossfades), and inset shadows are drawn.
- A blurred `box-shadow`, outer or inset, is drawn as nine gradient-filled pieces that follow the blur's falloff, not through a filter, so it stays smooth and cheap however far the picture is zoomed.
- `linear-gradient` and `radial-gradient` layers (repeating ones too) are drawn as SVG gradients that ride along with their box. `::before` and `::after` are read where Chromium laid them out, through the DevTools protocol, and drawn as boxes named `::before` and `::after` with their text. A see-through fill under `backdrop-filter: blur()` is drawn more solid instead of blurred.
- Text that leaves one element and arrives in another, saying the same thing in nearly the same place (an app swapping its editor for the rendered text), stays put instead of fading. Text a field loses whole (a todo input emptied by Enter) slides to the same text in a new element, wherever it is, and the placeholder fades back; with nowhere to go it deletes character by character.
- A `::before` or `::after` draws the text Chromium laid out for it, so counters and `attr()` come along, and a color input draws its value in its swatch.
- A `<canvas>` is drawn as a still of what it shows at each snapshot (a WebGL one, or a tainted one, through a screenshot of it alone), so an animated canvas holds one frame per snap. Open shadow roots are read like the rest of the page, and `text-overflow: ellipsis` draws its "…". `mix-blend-mode` and `isolation: isolate` are drawn, and an `<img>` with a border, background or shadow is a box around its picture.
- Pictures are cut down to what the drawing needs: a raster is scaled to at most twice its drawn size and re-encoded as WebP (animated ones and small files stay as they are), and an SVG with only a `viewBox` is given a width and height so it draws at any scale. A page's variable or ranged font stays WOFF2 instead of being unwrapped to a TTF.
- Not drawn yet: range inputs' tracks and thumbs, conic gradients, `background-size` tiles, background images, clips between an element with a `z-index` and its stacking context, the fade of a gradient `mask-image` (it only clips to the box), and `<text>` in an inline SVG outside a `<mask>`.

## React demos

Film your app's real components, not markup copied out of them. A `.demo.tsx` file next to a component says what happens to it, and `recordings()` renders it through the app's own Vite config, so its CSS, Tailwind, fonts and imports are the app's:

```tsx
// SignIn.demo.tsx
import { demo, fill, hover, snap, wait } from "@svjeez/dom/react";
import { SignIn } from "./SignIn.tsx";

export const signIn = demo(SignIn, { width: 360 }, ({ props }) => [
  snap("idle"),
  fill("email", "sai@example.com"), snap({ over: 0.9 }),   // the component's own state
  hover("submit"), snap({ over: 0.15 }),
  props({ error: "Unable to sign in." }), snap({ over: 0.25 }), // re-render from outside; typed text stays
  wait(1.8),
]);
```

```tsx
// scene.tsx
import { recordings } from "@svjeez/dom/vite";

const demos = await recordings<typeof import("./SignIn.demo.tsx")>(here("SignIn.demo.tsx"), {
  cache: here("snapshots.json"),
});

<Dom states={demos.signIn} />;
```

- `demo(Component, { props, width, pad, parts }, script)` starts the component with `props` (required when it has required props). `script({ props })` returns any flow `dom.run` takes; its `props(patch)` re-renders the component with the patch merged over its props, as a parent would, and is typed to the component: a wrong name or type doesn't compile. Patches cross into the page, so their values must be JSON. Import the flow's other words from `@svjeez/dom/react` in a demo file: it runs in the browser too.
- `recordings(file, options)` starts a Vite dev server for the file's folder (its `vite.config`, merged with `options.vite`), records every demo the file exports, and resolves to their steps by export name. It needs `vite`, `react` and `react-dom`.
- The recording is kept in `cache`. It is made again when a demo's flow changes, or any file the demo file imports, however deep.
- `examples/demos` films a shadcn sign-in form and a pull request card this way.

## Camera

`shots(steps, plan, { frame })` turns a recording into svjeez's `<Camera>` props, so the picture follows what's changing like a screen recording that zooms in. `plan` names a part (or `"all"`) per snapshot name; the camera moves to it as the timeline moves into that snapshot, and snapshots not in `plan` keep the shot before them.

```tsx
const frame = rect(0, 0, 400, 300);

<Camera {...shots(steps, { idle: "all", email: "email-field", failed: "all" }, { frame, zoom: 1.6 })}>
  <Dom states={steps} />
</Camera>
```

`margin` (default 16) is room kept around a part, `zoom` (default 2) the most a part is blown up, and `over` (default 0.5) how long each move takes; a shot that comes sooner waits its turn. A part near an edge is framed without showing past the snapshot. Clip the camera to its frame. `examples/zoom` films the sign-in demo this way.

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
