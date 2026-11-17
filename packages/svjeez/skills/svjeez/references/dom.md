# Recording HTML and components

Use `@svjeez/dom` to draw a real page or component inside a scene. Chromium lays out the page during the build. The recorder reads the layout into snapshot JSON, and `<Dom>` animates between snapshots as SVG.

```sh
npm i -D @svjeez/dom svjeez playwright-core
npx playwright-core install chromium-headless-shell
```

## Record a flow

A flow starts with `snap(name)`. Actions like `fill()`, `click()`, `hover()`, `press()` and `drag()` run against the live page. Use `act(page => …)` for other Playwright actions. Add `snap(name, { over, ease })` to animate into the next state and `wait(seconds)` to hold it. Use `duration(steps)` for the length of the clip and `size(steps)` for its canvas size.

```ts
import { click, fill, snap, snapshots, wait } from "@svjeez/dom";

const states = await snapshots("snapshots.json", { inputs: "form-v2" }, (dom) =>
  dom.run({ url: "http://localhost:5173/demo", root: "#form", ready: "#name" }, [
    snap("idle"),
    fill("#name", "Ada"),
    snap("typed", { over: 0.8 }),
    click("#submit"),
    snap("done", { over: 0.4 }),
    wait(0.6),
  ]),
);
```

`dom.run(markup, flow)` mounts HTML instead. Both return steps for `<Dom states={states} />`. Use a `<Clip>` to start the recording later in the scene. Add `loop(states)` to animate from the final state back to the first.

Use `data-part` or the `parts` option to name targets. Give moved elements a unique `data-key` so a card that moves between columns can slide to its new parent. `shots(states, plan, { frame })` turns named snapshots and parts into `<Camera>` props.

## React and Svelte

Declare a `demo(Component, layout, script)` in a file next to the component, importing from `@svjeez/dom/react` or `@svjeez/dom/svelte`. In the scene, call `recordings(file, { cache })` from `@svjeez/dom/vite` and pass the named demo’s steps to `<Dom>`. The recorder uses the app’s Vite config and reuses its cache when the demo and its imports are unchanged.

- [React demo](https://github.com/saiashirwad/svjeez/tree/main/examples/demos)
- [Svelte demo](https://github.com/saiashirwad/svjeez/tree/main/examples/svelte-demos)
- [Record an update-and-view model with `story()`](https://github.com/saiashirwad/svjeez/tree/main/examples/live-story)
- [Camera that follows parts](https://github.com/saiashirwad/svjeez/tree/main/examples/zoom)

## Cache and fidelity

Commit snapshot JSON to rebuild without repeating the capture. Pass `inputs` for dependencies the flow cannot see, such as a running app’s data or an `act()` callback. Set `SVJEEZ_DOM_REFRESH=1` to record again.

Pass `{ screenshots: "shots" }` to `snapshots()` to capture the Chromium view. Compare it with the SVG:

```ts
import { shotsDir } from "@svjeez/dom";
import { fidelity } from "@svjeez/dom/fidelity";

const report = await fidelity(shotsDir("shots", "snapshots.json"), {
  name: "typed",
  out: "diffs",
  includePassing: true,
});
```

Each result includes the mismatch fraction, the selected color scheme and any detected approximations with element names. Omit `name` to compare all states. Omit `includePassing` to write visuals only for states above the mismatch threshold.

Common approximations include gradient masks, backdrop blur and custom OpenType features. Canvas content is captured as a still for each snapshot. Use the side-by-side and diff for visual results that the diagnostic rules cannot identify.
