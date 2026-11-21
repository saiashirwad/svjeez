---
name: svjeez
description: Use when writing, editing or debugging a svjeez scene (a .tsx file whose default export is scene(...)) that compiles to a zero-JS animated SVG.
---

# svjeez scenes

A scene is a tree of nodes (`Shape`, `Text`, `Group`, `Stack`, `Grid`, `Center`, `Align`, `Arrow`, `Picture`) whose props are values or tracks over time. svjeez lays it out, checks it and emits one animated SVG. You never write SVG, ids or CSS. Import everything from `"svjeez"`.

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
        draw={track(0).to(1, span(0.2, 1), ease.linear)}
      />
      <Shape
        geometry={circle(8)}
        offset={[120, 44]}
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

`size: [w, h]`, `duration` (s), `title` (required), `desc`, `theme` (optional), `loop` (default `true`; **one-shot scenes need `loop: false`**), `still` (second shown to reduced-motion viewers, or `false`). `build` gets `canvas` (`.rect`, `.size`, `.center`). Paint your own background.

## Placing

- Box = the node's paint, stroke included: a `Stack` with a 4-wide stroke needs `width` 8 more than its content (an error names the needed size, so leave `width` out). `at={p}` puts the node's `anchor` point of its box at p (default `"top-left"`). `anchor` without `at` is an error.
- `offset={p}` moves the node's own `[0, 0]` to p, on every node, no anchor. Use it for `circle`, `ellipse`, `arc` (drawn around `[0, 0]`) and for Groups used as frames. `at` with `offset` is an error.
- `anchor`: `"top-left" "top" "top-right" "left" "center" "right" "bottom-left" "bottom" "bottom-right"` or `[0.5, 1]`; Text adds `"baseline-left" "baseline" "baseline-right"`. Nothing else (`"middle"`, `"start"`) is valid. **`anchor="baseline"` centres the text horizontally on `at`; left-aligned labels need `baseline-left`** (`check` can't tell).
- `rotate`, `scale`, `skew` turn around `origin`: a place name (default `"center"`), `[x, y]` from the box's top-left, or `"at"` (the point `at`/`offset` places).
- `rect` has its corner at `[0, 0]`; `line`, `polygon`, `path` stay where their points are.
- `Stack`/`Grid`/`Center` size to their content and take `fill`, `stroke`, `radius`, `padding` (`gap`, `align`, `width`/`height` optional): a card needs no measured size. Their children take no `at`/`offset` (the container places them); to move one, wrap it in `<Group motion={{ offset: track }}>`.
- `<Align>` can't sit inside a Stack (wrap it in a Group). `<Align place="center" inset={16}>` puts that place of its content on the same place of the canvas, or of `to={ref}`; it follows the ref's animated box, so an enter `scale` on the ref shifts it.
- Clip: `<Group clip={rect(100, 30)}>` clips to any geometry (a track animates it).
- A label following a moving point: `<Group offset={pointTrack}>` with the dot and the label inside.
- Refs: `const a = ref()`, `<Stack ref={a}>`, then `a.right`, `a.center`, ... are points (never sizes): `<Arrow from={a.right} to={b.left} stroke={{ color, width: 2 }} head={8} inset={4} />` (`head`: size or `"none"`; also `bend`, `draw`).
- Nothing inherits: each `Text` needs `font`, `size`, `fill`; a `Shape` needs `geometry` and a `fill` or `stroke`.
- Keys: `key="x"` or `key={3}`, unique among **all** siblings of one parent: two `.map()`s in one parent collide on index keys, so prefix (`key={`a${i}`}`).

## Geometry

`rect(w, h, { radius })` (radius a number or `[tl, tr, br, bl]`), `circle(r)`, `ellipse(rx, ry)`, `arc({ radius, start, sweep })`, `line(...pts)`, `polygon(...pts)`, `path().moveTo().lineTo().curveTo(c1, c2, to)`. Sizes are plain numbers; to animate one, track the geometry: `geometry={track(rect(40, 10)).to(rect(120, 10), span(0.5, 1), ease.inOut)}`.

## Time

- `span(start, over)` is a window in seconds; `s.next(over, gap?)`, `s.shift(dt)`, `s.end`.
- `track(v)`: `.to(value, span, curve?)`, `.set(value, span)`, `.loop(period)`, `.repeat(n)`, `.rewind(over)`, `.map(fn)`, `.span`. Each returns a new track. `.set` cuts at `span.start`; its length is ignored. `loop(period)` counts from 0s (a motion starting at 0.4s waits 0.4s each cycle); `repeat()` counts from the first step. The curve is the third argument of `.to`, never part of `span`: `.to(1, span(0, 1), ease.linear)`. Steps must not overlap: start the next at `first.next(over)`.
- Curves: `ease.out` (default), `ease.in`, `ease.inOut`, `ease.pop`, `ease.linear`, `ease.spring()` (`.settle` is its span), `ease.steps(n)`/`ease.hold` (jumps), or any `(k) => number` on 0..1 (`(k) => k * k`).
- Stepped motion: `track(0).to(4, span(0, 4), ease.linear).map((v) => Math.floor(v) * 25)` (4 jumps of 25), or `.to(4, span, ease.steps(4))` when the curve alone is enough. Motion periodic on whole seconds hides at `--times 0,1,2`: sample off-grid (`0.3,1.3`).
- Tracks work for: `at offset rotate scale skew opacity fill`, stroke `color`/`width`, `draw`, `trim`, `clip`, `geometry`, effect values. Plain numbers only: `Text size`, `width`, `letterSpacing`, `rect()`/`circle()` arguments, and `dash` (a plain array such as `[4, 4]`, not a number).
- One number driving several props: one track plus `.map()`; `t.map((v) => [x, y])` is already a point, no annotation. A track inside a point (`[0, track]`) is an error: map to the whole point.
- Orbit or ellipse: `const u = track(0).to(1, span(0, duration), ease.linear)`, then `u.map((k) => [cx + rx * Math.cos(k * 2 * Math.PI), cy + ry * Math.sin(k * 2 * Math.PI)])`; use whole turns per loop (`k * 4 * Math.PI` is two) so the seam closes. Same for rotation: `to(360)` or `to(720)` close the loop; any other end angle (`to(270)`) is a seam jump.
- `draw` (0..1) draws a stroke on; a circle starts at 3 o'clock, so add `rotate={-90}` to start at the top. A fill showing at 0s while the stroke draws in is a `visible-at-zero` error: fade the fill in.
- `<Sequence when={span(...)}>` starts a local clock for its children. `random(seed)` is a seeded `() => number`; never `Math.random()`.
- `import { type Vec, type Color } from "svjeez"`. Only `track(zero)` of a variable needs `track<Vec>(zero)`, since `const zero = [0, 0]` infers `number[]`. Generic helpers can use `Goal`, `Derived`, `Anim`.

## Motion layers

`motion` is a layer or array (`offset rotate scale skew opacity`): `enter(span, { from, curve })`, `exit(span, { to, curve })`, `wiggle({ offset: [4, 4] }, { seed: "x" })`. `enter`/`exit` merge `from`/`to` over `{ opacity: 0 }`, so the node is hidden outside its span; pass `opacity` yourself to change that. `along(path, progress, { turn: true })` rides a path by arc length (`progress` a number or track; `turn` faces its heading, so draw the marker pointing right). Put the node at the path's origin: `<Shape geometry={circle(6)} fill={theme.red} motion={along(route, track(0).to(1, span(0, 3), ease.linear), { turn: true })} />`. Prefer layers to animating `at`.

## Text and fonts

- No default font. Examples: `geist` (400, 600), `geistText` (400, 600, 400 italic) from `examples/fonts/faces.ts`; `mono` (JetBrains Mono 400) and `theme` from `examples/theme.ts`. Use `geist.face(600)` or `weight={600}`. A weight you did not load is an error.
- Other fonts: `await google.family("Inter", [{ weight: 400 }, { weight: 700 }])` from `"@svjeez/fonts"`, or `font.family(await font.load("A.ttf", { weight: 400 }), ...)`.
- Wrap with `width`; inline styles with `<Run weight={600}>`.
- `<Text>{label}</Text>` with a `Track<string>` swaps the text instantly. `{typed(track("").to("Hello", span(0, 1)), { by: words, caret: true })}` types it (`by`: `chars` default, `words`, or your own split). `{count(track(0).to(100, span(0, 2)), { rate: 10, format: numeral({ decimals: 1 }) })}` counts: `rate` is changes per second (default 30), `format` is `(n) => string`; the default is `numeral()`: rounded to `decimals` (0), thousands grouped (`9,000`), `pad` digits. One `<Text>` counts or types, not both.
- Code: `@svjeez/code` has `<Code lang="ts" font={mono} size={12} palette={tomorrow} typing={span(0, 1)}>{"const x = 1;"}</Code>` (`tomorrow` from `@svjeez/code/palettes`), Shiki-highlighted from the scene's palette; see `examples/code/index.tsx`.

## Paint

- Colors (theme tokens switch per colour scheme by themselves): `"#RRGGBB"` / `"#RRGGBBAA"` or theme tokens. Not `"red"`. The theme is optional: hex works alone. Tokens in `examples/colors.ts`: `background surface raised border muted text red orange yellow green cyan blue magenta`.
- A color in a variable: type it `Color`, or `as const`; a plain `string` fails with an `Anim<Paint>` error. Same for gradient stops built outside the call.
- `mix(a, b, share)` blends `share` of a into b. It is NOT a translucent colour: `mix(theme.background, theme.yellow, 0.2)` is 20% background, 80% yellow. For a faint colour: `mix(theme.yellow, "#00000000", 0.2)`, or `"#RRGGBBAA"`. A translucent thin stroke trips `low-contrast`: give it width or a stronger colour.
- `stroke={{ color, width, cap, join, dash }}`. Gradients: `linear.across({ angle: 90, stops: [theme.blue, theme.cyan] })`, `linear({ from, to, stops })`, `radial.across({ stops })`, `radial({ center, radius, stops })`; stops are colors or `[offset, color]`, not mixed. `pattern({ size, tile })`. Effects: `effects={[blur(4), shadow({ color: theme.text, blur: 6, offset: [0, 3], opacity: 0.3 })]}`; a blur under 1.5 units warns (WebKit draws it softer). An animated shadow `opacity` works but redraws every frame (`moving-filter` info); animated `blur` is worse, so keep blur still. A hex shadow colour is the same in both schemes (black vanishes on dark): pass a theme token, which switches.
- Contrast: coloured text on a coloured fill passes in one scheme and fails in the other; pair `theme.text` on `theme.background`/`surface`, and check both.

## Morph

`morph.between(states, spans, options)`: `states` are N children, `spans` are N-1 windows in order, each state's nodes keyed and matched by key (unique within their parent). `options`: `curve`, `stagger`, `enter`, `exit`. To move a card between columns, key the card with a key unique in each state (`key="audit"`) and key the columns too: it travels from its old box to its new one (rules in `packages/svjeez/skills/svjeez/references/morph.md`). `morph(before, after, span)` is the two-state form. See `examples/morph/index.tsx`.

## Seamless loops

With `loop: true`, end every motion where it began: `track(0).to(1, a).to(0, b)`, `.rewind(over)`, `exit()`, or `.loop(period)` where the period divides `duration`. Something that enters must leave before `duration`. `loop-seam` ignores nodes off canvas at both ends.

## Check workflow

From the repo root, after every change (`my/scene` is `examples/my/scene.tsx`, `examples/my/scene/index.tsx`, `site:<name>` or a path):

```sh
bun run scene check my/scene
bunx tsc --noEmit -p examples      # type errors: check from source does NOT run TypeScript (only the bin does)
bun run scene frames my/scene --sheet --out /tmp/frames   # Read /tmp/frames/sheet.png
```

`--times 0,1,2` picks frames. `check` tests both colour schemes; `--color-scheme dark` on `frames` renders dark. **Always Read a frame**: `check` misses mis-anchored text and some overlaps of your own shapes. One-shot scenes are sampled to their end; `frames` and `check` use the scene's `duration`. Fix every error, read each warning against a frame. `examples/tsconfig.json` has `noUncheckedIndexedAccess`: index `as const` tuples or per-item objects, not `arr[i]` of a plain array. `wasted-motion` (info) means a node changes while hidden; fine to leave when intentional, otherwise start it at its shown value. `moving-box` warns when a group placed with `at`/`anchor` has moving content; use `offset`. More patterns: `examples/readme/hero.tsx`, `layout/`, `springs/`, `epicycles/`.

## Traps

- `at` + `anchor` on a Group pins its measured box, which includes animated children. To move children as a unit, use `offset`.
- `rect(track(w), h)` is an error: track the whole geometry.
