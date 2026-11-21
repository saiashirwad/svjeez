---
name: svjeez
description: Use when writing, editing or debugging a svjeez scene (a .tsx file whose default export is scene(...)) that compiles to a zero-JS animated SVG.
---

# svjeez scenes

A scene is a tree of nodes (`Shape`, `Text`, `Group`, `Stack`, `Grid`, `Center`, `Align`, `Arrow`) whose props are values or tracks over time. svjeez measures, lays out and checks it, then emits one animated SVG. You never write SVG, ids or CSS. Everything is imported from `"svjeez"`.

```tsx
import { Group, Shape, Text, circle, ease, enter, path, scene, span, track } from "svjeez";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

const sans = geist.face(400);

export default scene(
  { size: [240, 140], duration: 4, title: "Hello", desc: "A curve draws, a dot pops in.", theme, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
        stroke={{ color: theme.blue, width: 4, cap: "round" }}
        draw={track(0).to(1, span(0.2, 1))}
      />
      <Shape
        geometry={circle(8)}
        at={[120, 44]}
        anchor="center"
        fill={theme.text}
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
      <Text font={sans} size={14} at={[120, 132]} anchor="baseline" fill={theme.text}>
        hello
      </Text>
    </Group>
  ),
);
```

## scene(options, build)

`size: [w, h]`, `duration` (seconds), `title` (required), `desc`, `theme` (a `tokens()` palette), `loop` (default `true`; `false` plays once and holds), `still` (second shown to reduced-motion viewers, or `false`). `build` gets `canvas` (`canvas.rect`, `.size`, `.center`). Paint your own background: `<Shape geometry={canvas.rect} fill={theme.background} />`.

## Coordinates

- Every node has a box (its paint, stroke included). `at` is where the node's `anchor` point goes. Default anchor is `"top-left"` of the box.
- `anchor`: `"top-left" "top" "top-right" "left" "center" "right" "bottom-left" "bottom" "bottom-right"` or `[0.5, 1]` fractions of the box. Text also accepts `"baseline-left" "baseline" "baseline-right"`.
- `circle`, `ellipse`, `arc` are drawn around their own `[0, 0]`, so give them `at` + `anchor="center"`. `rect` has its corner at `[0, 0]`; `line`, `polygon`, `path` stay where their points are.
- `Shape`, `Text`, `Picture` take `at`. A `Group` used as a frame takes `offset`: where its children's `[0, 0]` goes. `at` and `offset` together is an error.
- Children of `Stack`, `Grid`, `Center` get placed by the container and take no `at`. `<Align place="center" inset={16}>` places against the canvas, or `to={ref}`.
- `rotate`, `scale`, `skew` turn around `origin` (`"center"` by default).
- Refs: `const card = ref()`, `<Stack ref={card}>`, then `card.right`, `card.center`, `card.left` ... as a point for `<Arrow from={a.right} to={b.left} />`.
- Nothing inherits: each `Text` needs `font`, `size`, `fill`; a `Shape` needs `geometry` and a `fill` or `stroke`.

## Time

- `span(start, over)` is a window in seconds; `s.next(over, gap?)`, `s.shift(dt)`, `s.end`. A bare number is only a length.
- `track(v)` makes a value over time; every method returns a new track: `.to(value, span, curve?)`, `.set(value, span)`, `.loop(period)`, `.repeat(n)`, `.rewind(over)`, `.map(fn)`, `.span` (of the last step).
- `opacity={track(0).to(1, span(0.5, 0.3))}`. Steps must not overlap: start the next at `first.next(over)`.
- Curves: `ease.out` (default), `ease.in`, `ease.inOut`, `ease.pop`, `ease.linear`, `ease.spring()` (its `.settle` is the span it needs).
- One number driving several props: one track plus `.map()`, not parallel tracks.
- `draw={track(0).to(1, span(...))}` on a stroked Shape draws it on.
- `<Sequence when={span(...)}>` starts a local clock for its children.

## Enter / motion

`motion` is a layer or an array of layers (`offset rotate scale skew opacity`, each a value or track) on top of the node's own props: `enter(span, { from, curve })` (default from opacity 0), `exit(span, { to })`, `wiggle({ offset: [4, 4] }, { seed: "x" })`, or `{ opacity: track(...) }`. Prefer these to animating `at`.

## Text and fonts

- No default font. The examples provide, in `examples/fonts/faces.ts`: `geist` (Geist 400, 600), `geistText` (400, 600, 400 italic), and `mono` (JetBrains Mono 400 only) from `examples/theme.ts`. Use `geist.face(600)`, or pass the family and set `weight={600}`.
- Another weight or family: `await google.family("Inter", [{ weight: 400 }, { weight: 700 }])` from `"@svjeez/fonts"` (downloads once, cached), or `font.family(await font.load("A.ttf", { weight: 400 }), await font.load("B.ttf", { weight: 700 }))`. Top-level `await` is fine in a scene file.
- Wrap text with `width`; inline styles with `<Run weight={600}>`. A changing number is `{count(track, { rate: 10 })}`; typing is `{typed(track("").to("Hello", span(0, 1)))}`.

## Paint

- Colors: `"#RRGGBB"` / `"#RRGGBBAA"` or theme tokens (`theme.blue`, a `tokens({ light, dark })` palette, one value per scheme). Not `"red"`. See `examples/colors.ts`.
- `stroke={{ color, width, cap, join, dash }}`. `mix(a, b, 0.5)` blends two paints.
- Gradients: `linear.across({ angle: 90, stops: [theme.blue, theme.cyan] })`, `linear({ from, to, stops })`, `radial.across({ stops })`, `radial({ center, radius, stops })`. `pattern({ size, tile })` repeats a tile. Effects: `effects={[blur(4), shadow({...})]}`.

## Seamless loops

Set `loop: true`, and end every motion where it began: `track(0).to(1, a).to(0, b)`, `.rewind(over)`, `exit()`, or a periodic `track(0).to(360, span(0, 2), ease.linear).loop(2)` whose period divides `duration`. Something that enters must leave before `duration`, or be visible from 0s.

## Check workflow (this repo)

From `examples/` (run `check`, then `frames`, then typecheck after every change):

```sh
bun ../packages/svjeez/src/cli.ts check my/scene.tsx
bun ../packages/svjeez/src/cli.ts frames my/scene.tsx --sheet --out /tmp/frames   # then Read the PNGs
bun run typecheck    # or: npx tsc --noEmit
```

Fix every error, read each warning against a frame, and look at the sheet before calling it done. `--times 0,1,2` picks frames, `--color-scheme dark` checks dark. More patterns: `examples/readme/hero.tsx` (springs, morph, refs, arrows, count), `examples/morph/index.tsx`, `examples/layout/index.tsx`, `examples/springs/index.tsx`, `examples/epicycles/index.tsx`, `examples/readme/loops.tsx`.

## Traps

- `anchor` without `at` is a compile error. Give it an `at`, or drop the anchor.
- `Shape` takes `at`; `Group` takes `offset`. Using both on one node errors.
- `at` + `anchor` on a `Group` pins the group's measured box, which includes animated children, not just where they rest. If a frame should move children as a unit, use `offset` instead.
- Text anchors are the nine places plus `baseline-left|baseline|baseline-right`. `"middle"`, `"start"`, `"center-left"` are errors.
- A string track is not `<Text>` children. Write `{typed(track("").to("Hi", span(0, 1)))}`.
- `track(x)` infers from `x`: a variable like `const zero = [0, 0]` gives `Track<number[]>`, which no `at` or `Track<Vec>` parameter accepts. Write `track<Vec>(zero)` (`import { type Vec }`), also for helpers that take or return tracks.
- Gradient stops are colors, or `[offset, color]` pairs, not mixed. A stop list built outside the call widens to `(string | number)[][]`: write it inline or `as const`.
- A font has only the weights you loaded: `weight={700}` on `mono` (one 400 face) is a compile error. Load the face and pass a family (`google.family`, `font.family`); `geist.face(w)` snaps to the nearest weight the family has.
- `loop-seam`: warns for any node that is on screen at 0s or at the end and differs between them. A node that is off-canvas at both 0s and the end (a dot that crosses the scene) is fine; one that starts off-canvas and stops on-canvas, or the reverse, warns. Start and end off-canvas, or `.rewind()`.
