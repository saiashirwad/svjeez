<h1 align="center">svjeez</h1>

<p align="center">
  <b>Write motion in TypeScript and JSX. Ship one zero-JS <code>.svg</code>.</b>
</p>

<p align="center">
  <img src="examples/dist/readme/hero.svg" alt="One spring track stretches a coil with a live readout, lifts a card whose tiles morph from a grid into bars while ref-attached arrows follow its edges, and drives a ring gauge with a zero-JS counter" width="720">
  <br>
  <sub><b>One spring track drives coil, morph, arrows, and counters</b> · 37 KB · 0 KB JS · <a href="examples/readme/hero.tsx"><code>examples/readme/hero.tsx</code></a></sub>
</p>

svjeez compiles JSX scenes into self-contained animated SVGs. Each file bundles light and dark themes, a `prefers-reduced-motion` still frame, and subsetted fonts, so it works anywhere `<img>` works: GitHub READMEs, docs, blogs, and email.

Every graphic in this README is a live, zero-JS `.svg` built with svjeez. Toggle your theme to watch them adapt.

## How the hero works

One spring `track` drives the scene: stretching the coil, lifting the center card as its keyed tiles `morph()` from a grid into bars, pinning both `ref()` `<Arrow>` connectors to the moving edges, and ticking two zero-JS `count()` readouts.

```tsx
const spring = ease.spring({ stiffness: 185, damping: 15 });
const signal = track(0)
  .to(1, span(0.4, spring.settle), spring)
  .to(0, span(3.4, spring.settle), spring);

const [driver, stage, output] = [ref(), ref(), ref()];

<Stack ref={stage} motion={{ offset: signal.map((v) => [0, -24 * v]) }}>
  {morph.between([gridState, barsState, gridState], [span(0.4, 0.7), span(3.4, 0.7)], {
    curve: ease.pop,
    stagger: 0.05,
  })}
</Stack>

<Arrow from={driver.right} to={stage.left} inset={8} stroke={{ color: theme.blue, width: 2 }} />
<Arrow from={stage.right} to={output.left} inset={8} stroke={{ color: theme.magenta, width: 2 }} />

<Shape
  geometry={circle(28)}
  draw={signal.map((v) => clamp(v, 0.02, 1))}
  stroke={{ color: theme.green, width: 5.5, cap: "round" }}
/>
<Text font={mono} size={14}>{count(signal.map((v) => clamp(v) * 100))}%</Text>
```

## Quick start

Install with npm or Bun. On Node 20+, also install `tsx` to load `.tsx` scenes:

```sh
npm install svjeez
npx svjeez svg scene.tsx --out scene.svg
```

Point TypeScript at svjeez's JSX runtime in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "jsxImportSource": "svjeez",
    "strict": true
  }
}
```

Run `npx svjeez dev scene.tsx` for a local preview with a timeline scrubber and live reload.

A minimal scene default-exports `scene(options, (canvas) => ...)`:

```tsx
import { Group, Shape, circle, ease, enter, path, scene, span, track } from "svjeez";

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Hello",
    desc: "A curve draws itself, then a dot pops in above it.",
    still: 3,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#18181b" />
      <Shape
        geometry={path().moveTo([20, 100]).curveTo([60, 20], [140, 20], [180, 100])}
        stroke={{ color: "#FF5FA8", width: 4 }}
        draw={track(0).to(1, span(0.2, 1.2))}
      />
      <Shape
        geometry={circle(8)}
        at={[100, 40]}
        anchor="center"
        fill="#3EE6D6"
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
    </Group>
  ),
);
```

<p align="center">
  <img src="examples/dist/readme/basic.svg" alt="A curve draws itself, then a dot pops in above it">
  <br>
  <sub><b>A curve draws, a dot pops in</b> · 1.5 KB</sub>
</p>

## Morph shapes, code, and math

Add a `key` across two or more JSX states and `morph()` diffs the tree at compile time—reordering, resizing, recoloring, entering, and exiting without manual keyframes. The same primitive works on plain geometry, Shiki-highlighted code (`@svjeez/code`), and MathJax TeX equations (`@svjeez/math`).

<p align="center">
  <img src="examples/dist/morph.svg" alt="A bar chart morphing across three quarters as bars reorder, resize, enter, and exit" width="640">
  <br>
  <sub><b>Keyed geometry morph</b> · 11 KB · <a href="examples/morph/index.tsx"><code>examples/morph/index.tsx</code></a></sub>
</p>

<p align="center">
  <img src="examples/dist/code.svg" alt="A TypeScript function typing itself, with a highlight walking through its blocks" width="480">
  <br>
  <sub><b>Shiki code that types itself</b> · 13 KB · <a href="examples/code/index.tsx"><code>examples/code/index.tsx</code></a></sub>
</p>

<p align="center">
  <img src="examples/dist/math.svg" alt="Quadratic equation rearranging step by step into the quadratic formula" width="640">
  <br>
  <sub><b>Build-time TeX derivation</b> · 25 KB · <a href="examples/math/index.tsx"><code>examples/math/index.tsx</code></a></sub>
</p>

## Draw a component, let the page own its state

A scene can declare named clocks and the states that rest them, so a framework keeps the state, the events and the accessibility, and the scene only draws. Each demo below is one scene plus a normal React component; the `.svg` plays a walk-through on its own.

<table align="center">
  <tr>
    <td align="center" valign="top">
      <img src="examples/dist/mascot.svg" alt="A robot above a sign-in form, its eyes following the pointer, lowering privacy blinds for the password" width="260">
      <br>
      <sub><b>Robot sign-in</b> · 29 KB · <a href="examples/mascot/index.tsx"><code>scene</code></a> · <a href="examples/react-widgets/Mascot.tsx"><code>form</code></a></sub>
    </td>
    <td align="center" valign="top">
      <img src="examples/dist/deploy.svg" alt="A deploy pipeline moving through build, test and release, with a failing test" width="260">
      <br>
      <sub><b>Deploy pipeline (XState)</b> · 62 KB · <a href="examples/deploy/index.tsx"><code>scene</code></a> · <a href="examples/react-widgets/Deploy.tsx"><code>machine</code></a></sub>
    </td>
    <td align="center" valign="top">
      <img src="examples/dist/watch.svg" alt="A watch escapement, the camera zooming to the wheel, the fork and the balance" width="260">
      <br>
      <sub><b>Watch escapement</b> · 58 KB · <a href="examples/watch/index.tsx"><code>scene</code></a> · <a href="examples/react-widgets/Watch.tsx"><code>controls</code></a></sub>
    </td>
  </tr>
</table>

Run them all with `cd examples/react-widgets && bunx --bun vite`. The scene gives a `<Sequence>` a `clock` and names where each state rests it; the span is where the clock plays in the plain file:

```tsx
const flip = clock("flip", span(0.5, 1));

export default scene(
  { size: [240, 120], duration: 2, title: "Switch", states: { off: { flip: 0 }, on: { flip: 1 } } },
  <Sequence clock={flip}>{/* a track and a knob; tracks count from 0 inside */}</Sequence>,
);
```

In React, `<Scene>` from `@svjeez/react` takes the current state and sits inside a real control, which brings the role, the keyboard and the focus. The scene is hidden from assistive technology; import it with `?svjeez&inline` (`@svjeez/vite`):

```tsx
import { Scene } from "@svjeez/react";
import art from "./switch.tsx?svjeez&inline";

<Switch.Root checked={on} onCheckedChange={setOn} aria-label="Notifications">
  <Scene scene={art} state={on ? "on" : "off"} />
</Switch.Root>;
```

The first state shows at once and each change plays from wherever the clocks are, at real speed, so an interrupted move turns around smoothly. `state` can be an [XState](https://stately.ai/docs/xstate) `snapshot.value`, nested and parallel states included (the deploy demo); `rests(scene, places)` is the same visual half for any other source of state. Another framework wraps `attach(element, { state })` from `svjeez/page`: attach on mount, `update` on change, `destroy` on unmount. See [`@svjeez/react`](packages/react/README.md).

Without a framework, `mount()` gives page code each clock to play, reverse, scrub or follow, and `hit="name"` marks shapes to listen on. The runtime also takes over the SMIL inside a clock (morphs, moving gradients, filters), and clocks nest, so a hop and a gaze compose:

```ts
import { mount, scrolled } from "svjeez/page";

const art = mount(document.querySelector("#card svg")!); // an inline <svg>
art.hit("card").forEach((el) => el.addEventListener("click", () => art.clock("open").play()));
art.clock("grow").follow(scrolled(card));
```

A `<Slot name="field" width={w} height={h}>` leaves a box in the layout for the page's own HTML: `art.slot("field").host(canvas)` puts a canvas there, moved by the scene's clocks, and the slot's children are the fallback the plain `.svg` shows. The [Signal card](examples/react-widgets/GpuCard.tsx) fills one with a live TypeGPU shader that reads the scene's storm clock every frame.

## Film a real web app

Skip redrawing UI by hand. `@svjeez/dom` drives a React, Svelte, or HTML app in Playwright, snapshots DOM states in light and dark mode, and compiles the transitions into one zero-JS `.svg`:

```tsx
import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/bun";
import index from "./index.html";

export default await film(
  serve(index, { selector: "#app" }),
  async ({ page, snap }) => {
    await snap("start");

    await page.locator('[data-key="col-todo"] button').first().click();
    await snap("moved", { over: 0.7 });

    await page.locator("input").pressSequentially("Write the docs", { delay: 15 });
    await page.getByRole("button", { name: "Add" }).click();
    await snap("added", { over: 0.7 });
  },
  { scheme: "both", title: "Sprint board", viewport: { width: 760, height: 560 } },
);
```

<p align="center">
  <img src="examples/dist/dom-react.svg" alt="A live React sprint board filmed into an animated light/dark SVG" width="680">
  <br>
  <sub><b>A real React app, filmed to a dual-theme SVG</b> · 33 KB · <a href="examples/dom-react/index.tsx"><code>examples/dom-react/index.tsx</code></a></sub>
</p>

## Compile-time layout and refs

`<Stack>`, `<Grid>`, `<Center>`, and `<Align>` measure text and boxes at build time. Attach `ref()` to any node and `<Arrow>` connectors or anchored elements stay locked to it while it moves:

<p align="center">
  <img src="examples/dist/layout.svg" alt="Cards arranged in a Stack with live ref-attached connectors" width="640">
  <br>
  <sub><b>Build-time <code>&lt;Stack&gt;</code> layout with moving <code>ref()</code> arrows</b> · 18 KB · <a href="examples/layout/index.tsx"><code>examples/layout/index.tsx</code></a></sub>
</p>

## Lint with `svjeez check`

`svjeez check` inspects the compiled scene model without launching a browser. It catches overlapping siblings, clipped elements, WCAG contrast failures in light and dark themes, broken loop seams, unreadable font sizes, and animation or repaint cost—with source locations and concrete fixes:

```sh
$ svjeez check examples/readme/hero.tsx
0 errors, 0 warnings, 0 info; model only
cost: 32.8 animations, 0 repaint
lanes: 27 css, 4 smil
```

Pass `--browser` to verify rendered bounding boxes and contrast in headless Chromium, `--at 0,0.75,2.5` to inspect layout at specific timestamps, or run `svjeez frames scene.tsx --sheet` for a PNG contact sheet.

## Inside the compiled `.svg`

- **Zero JavaScript**: Runs on GPU-friendly CSS `@keyframes` first, using SMIL only for attributes CSS cannot animate (path `d`, box dimensions, gradients, filters).
- **Reduced motion**: Freezes on your chosen `still` frame when `prefers-reduced-motion: reduce` is set.
- **Dual light and dark mode**: `tokens()` compiles theme colors to CSS custom properties under `prefers-color-scheme`.
- **Real `<text>`, subsetted fonts**: Keeps text crisp, selectable, and measurable, subsetting only used characters into embedded `@font-face` rules.
- **Zero-JS counters**: `count()` renders tabular odometer strips animated purely with CSS steps.
- **Accessible and deterministic**: Emits `role="img"`, `<title>`, and `<desc>`. Explicit `span(start, duration)` timing and seeded randomness produce byte-identical output.

## Add-on packages

**Content & visualization**
- `@svjeez/charts` — Animated bar, line, and area charts.
- `@svjeez/code` — Shiki syntax-highlighted code that types in and morphs across edits or languages.
- `@svjeez/math` — Build-time MathJax TeX equations, plots, and geometric constructions.
- `@svjeez/diagrams`, `@svjeez/mermaid` — Animated flowcharts, sequence diagrams, state machines, and Mermaid input.
- `@svjeez/icons` — Tabler and Lucide icons that draw stroke by stroke.
- `@svjeez/geo` — Maps and rotating globes from GeoJSON or TopoJSON.
- `@svjeez/fonts` — Fetches and caches Google Fonts on disk for subsetting.

**Capture, frameworks & export**
- `@svjeez/dom` — Films live web apps with Playwright into animated light/dark SVGs.
- `@svjeez/vite`, `@svjeez/astro` — Vite imports and an Astro `<Scene>` component.
- `@svjeez/react` — A `<Scene>` that animates to the state React, Radix or XState owns.
- `@svjeez/video` — MP4 and WebM export via `svjeez video`.

## License

svjeez is pre-1.0 and MIT licensed.
