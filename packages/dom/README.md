# @svjeez/dom

Record states of real HTML, React or Svelte in Chromium and animate the changes as a self-contained SVG.

```sh
npm i -D @svjeez/dom svjeez playwright-core
npx playwright-core install chromium-headless-shell
```

```tsx
import { Dom, duration, fill, size, snap, snapshots, wait } from "@svjeez/dom";
import { render } from "svjeez";

const states = await snapshots("snapshots.json", {}, (dom) =>
  dom.run('<label>Name <input data-part="name"></label>', [
    snap("empty"),
    fill("name", "Ada"),
    snap("typed", { over: 0.8 }),
    wait(0.6),
  ]),
);

export default () =>
  render({ ...size(states), duration: duration(states), title: "Typing a name" }, <Dom states={states} />);
```

Use `dom.run({ url, root }, flow)` to film a running app, or `demo()` from `@svjeez/dom/react` or `@svjeez/dom/svelte` with `recordings()` from `@svjeez/dom/vite` to run real components with the app’s CSS. `data-part` names a target for actions and camera shots. `data-key` keeps an item paired between snapshots, including when it changes parents.

Commit the snapshot JSON to reuse a capture in later builds. Pass `inputs` to invalidate it when an external page or an `act()` callback changes. `SVJEEZ_DOM_REFRESH=1` records it again.

## Compare a capture

Pass `{ screenshots: "shots" }` to `snapshots()` and run `fidelity(shotsDir("shots", "snapshots.json"), { out: "diffs" })` from `@svjeez/dom/fidelity`. The report compares the SVG with Chromium at each captured state and writes side-by-side images for states over the mismatch threshold. Pass `{ name: "typed", out: "diffs", includePassing: true }` to inspect one state even when it passes. The report names elements with detected approximations such as gradient masks, backdrop blur and some font settings.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/board"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/board.svg" width="540" alt="A recorded project board opens a task dialog and moves a card between columns." /></a>

[React example](https://github.com/saiashirwad/svjeez/tree/main/examples/demos) · [Svelte example](https://github.com/saiashirwad/svjeez/tree/main/examples/svelte-demos) · [Camera example](https://github.com/saiashirwad/svjeez/tree/main/examples/zoom)

[Recording and fidelity reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/dom.md)
