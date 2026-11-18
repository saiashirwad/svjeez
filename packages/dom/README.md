# @svjeez/dom

Record states of real HTML, React or Svelte in headless Chromium as data an svjeez scene can draw. This package reads and records; drawing a snapshot is not part of it yet.

```sh
npm i -D @svjeez/dom@next svjeez@next playwright-core
npx playwright-core install chromium-headless-shell
```

```ts
import { fill, snap, snapshots, wait } from "@svjeez/dom";

const states = await snapshots("snapshots.json", {}, (dom) =>
  dom.run('<label>Name <input data-part="name"></label>', [
    snap("empty"),
    fill("name", "Ada"),
    snap("typed", { over: 0.8 }),
    wait(0.6),
  ]),
);
```

Use `dom.run({ url, root }, flow)` to film a running app, or `demo()` from `@svjeez/dom/react` or `@svjeez/dom/svelte` with `recordings()` from `@svjeez/dom/vite` to run real components with the app's CSS. `data-part` names a target for actions. `data-key` keeps an item paired between snapshots, including when it changes parents.

Commit the snapshot JSON to reuse a capture in later builds. Pass `inputs` to invalidate it when an external page or an `act()` callback changes. `SVJEEZ_DOM_REFRESH=1` records it again.

Animations the page is running when a snapshot is read come back as `anims` on the element, and `cssEase` turns a CSS easing into an svjeez curve.
