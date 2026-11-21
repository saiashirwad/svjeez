---
name: svjeez
description: Write animated SVGs with svjeez, a TypeScript library that compiles a scene of typed nodes, layout and tracks into one self-contained animated SVG (and frames or video) with no runtime JavaScript. Use when asked to make, edit or debug an animated SVG, a svjeez scene, an animated UI mockup, explainer, chart or loader in TypeScript, or when a project imports svjeez.
---

# svjeez

## What a scene is

A scene is a TypeScript file whose default export is `scene(options, build)`. `build` is handed the canvas and returns a tree of nodes (`<Shape>`, `<Text>`, `<Group>`, layout containers, `<Arrow>`). Every animated prop takes a value or a track over time. svjeez lays it out, measures the text with its real font, checks it, and writes one animated SVG that plays with no JavaScript, in light and dark. You never write SVG: no transforms, ids, defs, path strings for shapes, or CSS.

```tsx
/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, ease, enter, path, scene, span, track } from "svjeez";
import { sans, theme } from "./style";

export default scene(
  {
    size: [240, 140],
    duration: 4,
    loop: false,
    title: "Hello",
    desc: "A curve draws itself, a dot pops in on top of it, and the word hello sits below.",
    theme,
    still: 2.5,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
        stroke={{ color: theme.blue, width: 4, cap: "round" }}
        draw={track(0).to(1, span(0.2, 1.2))}
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

## Setup

```sh
npm i svjeez@next && npm i -D tsx typescript playwright-core && npx playwright-core install chromium-headless-shell
bun add svjeez@next    # under Bun, run the CLI as: bunx --bun svjeez
```

In `tsconfig.json` set `"jsx": "react-jsx"`, `"jsxImportSource": "svjeez"` and `"strict": true`, or start each scene file with the pragma above. Companion packages (`@svjeez/fonts`, `icons`, `charts`, `code`, `diagrams`, `mermaid`, `geo`, `math`, `video`) install as `@svjeez/<name>@next`. With no Node project at all, use the single-file `svjeez` binary from svjeez's GitHub releases: it carries svjeez, every companion package and TypeScript, so a lone `scene.tsx` in any folder works; `svjeez init <dir>` writes a `tsconfig.json`, editor types and a starter scene, and its `check` also reports type errors as `type-error`.

`scene()` takes `size` (`[width, height]`), `duration` (seconds of one loop), `title` (required, read by screen readers), `desc`, `theme` (tokens), `loop` (`false` plays once and holds) and `still` (the second a viewer who asked for less motion sees, held still; 85% through by default, or `false`). The default export may be a function that returns a scene, which is how a scene takes params: `export const params = { n: param.count(3, { max: 8 }) }` ([`references/params.md`](references/params.md)).

## The model in eight rules

1. **Every node has a box**: what it paints, its stroke included, measured when the scene compiles. Text too.
2. **`at` places the node's `anchor`**, the box's top-left unless `anchor` names another point (`"center"`, `"bottom-right"`, `[0.5, 1]`, and for text `"baseline"`). A node with no `at` stays where its coordinates put it; `anchor` without `at` is an error. `offset` (any node, not with `at`) moves the node's own `[0, 0]` there instead: a circle drawn around `[0, 0]` goes with `offset={[120, 44]}` and no `anchor`, and a `<Group>` frame's children keep their own coordinates inside it. Text's `[0, 0]` is the top-left of its first line. `rotate`, `scale` and `skew` (degrees of shear along x, before scale and rotate) turn around `origin`: `"center"` of the box by default, or `"at"`, a place, or a point.
3. **Nothing is inherited.** A shape with no fill has none; every `<Text>` needs its own `font`, `size` and `fill`. There is no default font. Share styles with components or spread objects.
4. **A prop takes a value or a track**, and tracks are immutable values: `opacity={track(0).to(1, span(0.5, 0.3))}`. Name the spans first, build each track, then write the JSX. `to`, `set`, `loop`, `repeat` and `rewind` return a new track.
5. **Time is spans on clocks.** `span(start, over)` is when; build each beat from the one before (`a.next(0.4)`, `a.chain(…)`, `a.cascade(3, 0.1)`, `a.shift(dt)`). A plain number is only ever a length. `<Sequence when={span(…)}>` starts a clock of its own.
6. **Containers place children.** `<Stack>`, `<Grid>`, `<Center>` and `<Align>` measure boxes and set each child's place; a child in one takes no `at`. Prefer them to coordinates you compute.
7. **Refs are handles that move nothing.** `const card = ref()`, `<Group ref={card}>`, then `card.right`, `card.center`, `card.part("title")` from anywhere: arrows attach to them, `<Align to={card}>` places against them, a track's `at` goes to them.
8. **Morph goes between keyed states.** `morph.between([a, b, c], spans)` matches nodes by `key`: one in both states moves, resizes and recolors; one only in the later state enters; one only in the earlier leaves.

## Cheat sheet

| Nodes | |
| --- | --- |
| `<Shape geometry fill stroke draw trim>` | `stroke={{ color, width, cap, join, dash, dashOffset, fixedWidth, under }}`; `draw` is 0 to 1, `trim={[from, to]}` a window; not both |
| `<Text font size fill weight italic width lineHeight align along start stroke>` | strings and `<Run weight fill italic opacity>` inside; `width` wraps; `along={geometry}` sets one line along an outline |
| `count(value, { format, rate })` | a number that counts, as the only content of a `<Text>` besides strings |
| `typed(value, { by, caret })` | a string track typed out, last in a `<Text>`: each `.to()` erases back to the shared start, then types; `by` is `chars` (default), `words` or your own split |
| a string track as the only child of a `<Text>` | a label that swaps: each value shows instantly, a `.set()` at its time and a `.to()` when its span is over (never partway), each measured with the real font and anchored on its own, so a centred label stays centred. `<Text font size fill at={[x, y]} anchor="center">{track("CLOSED").set("SYN_SENT", span(0.9, 0)).set("ESTABLISHED", span(5, 0))}</Text>` |
| `<Group offset>` | moves children together; `offset` is where the group's `[0, 0]` goes, as on any node |
| `<Picture src={picture(bytes)} width height>` | a PNG, JPEG, GIF, WebP or SVG; `picture.load(path)` reads a file |
| `<Sequence when={span}>` | a local clock: tracks inside count from the span's start |
| `<Arrow from to stroke bend inset head draw>` | between points or anchors; follows them as they move |

Every node also takes `key ref at anchor origin rotate scale skew opacity motion clip mask effects blend scheme`. `scheme="light"` or `"dark"` shows a node in that color scheme only ([`references/paint.md`](references/paint.md)).

| Geometry (a track of them morphs) | |
| --- | --- |
| `rect(w, h, { radius })`, `circle(r)`, `ellipse(rx, ry)`, `arc({ radius, start, sweep })` | circles, ellipses and arcs are drawn around their own `[0, 0]` |
| `line(...points)`, `polygon(...points)` | stay where their points are |
| `path().moveTo(p).lineTo(p).curveTo(c1, c2, p).quadTo(c, p).close()`, `path.parse(d)` | a path built in code, or read from path data |
| `moved(g, by)`, `subtract(base, ...cuts)`, `canvas.rect`, `canvas.size`, `canvas.center` | somewhere else; holes; the scene's own rect (`canvas` is the callback's argument) |

| Paint | |
| --- | --- |
| `tokens({ light, dark })`, `"#RRGGBB"`, `"#RRGGBBAA"` | named colors with a value per scheme; plain hex is the same in both; type a palette `readonly Color[]` or `as const` |
| `mix(a, b, share)` | `share` (0 to 1) of `a` blended into `b`; with a token in either, a token the SVG blends live from the two |
| `linear()`, `linear.across()`, `radial()`, `radial.across()`, `pattern({ size, tile, offset })` | gradients at points or across the box; a tile of nodes repeated |
| `blur(r)`, `shadow({ color, offset, blur })`, `adjust({ hue, saturate })`, `displace({ scale, frequency, seed })` | `effects={[…]}`; also `clip`, `mask` and `blend` ([`references/paint.md`](references/paint.md)) |

| Time and motion | |
| --- | --- |
| `span(start, over)`, `span(start)` | `.end .next(over, gap) .shift(dt) .chain(...overs) .cascade(n, step)` |
| `track(v).to(v2, span, curve?).set(v3, when).loop(p).repeat(n).rewind(over)` | also `.span` (of the last step), `.map(fn)`, `.with(other)` |
| `through(value, fn)`, `within(draw, from, to)` | map a number or track; a part's own 0-to-1 share of a whole's progress |
| `motion={[{ opacity: track… }, enter(span, { from }), exit(span, { to }), wiggle(amp, { seed })]}` | layers: plain objects of `offset rotate scale skew opacity`; first outermost, the node's own props innermost |
| `sampled(fn, span, { tolerance })` | any function of time (`t` from 0) fitted to few keys |
| `ease.out`, `ease.in`, `ease.inOut`, `ease.pop`, `ease.linear`, `ease.spring()` | curves (default `ease.out`); a spring's `.settle` is the span it needs |
| `morph(a, b, span)`, `morph.between(states, spans, { stagger, enter, exit, curve })` | state to state by key |

| Layout | |
| --- | --- |
| `<Stack direction gap align justify padding width height>` | children in a row or column; `justify={spread}` spaces them across a fixed size; `stretch` widens children |
| `<Grid columns gap justify align padding>` | rows of cells as wide as their widest child |
| `<Center padding width height>` | children centered on each other: a label on a shape, a pill |
| `fill stroke radius` on those three | a background as big as the container: a card, a window, a row |
| `<Align to place inset>` | places children against the canvas (default), a box or a ref |

Refs: `ref()`, anchors `center left right top bottom topLeft topRight bottomLeft bottomRight`, `side(edge, t)`, `.map(([x, y]) => …)`, `.part(key)`.
Fonts and data: `font(bytes)`, `font.load(path)`, `font.family(...faces)`, `google()` from `@svjeez/fonts`, `picture()`, `param.number`, `param.count`, `param.seconds`, `param.color`, `param.easing`, `param.choice`, `param.text`, `param.list`.

## One way to do each thing

- **A prop changes on its own schedule**: give the prop a track. `fill={track(theme.text).to(theme.blue, span(1, 0.3))}`.
- **A node arrives, leaves or wobbles**: a layer in `motion` (`enter`, `exit`, `wiggle`, or `{ opacity: track(…) }`). Layers multiply opacity and add offsets on top of the node's own props, so an entrance never fights a prop's track.
- **Scattered things** (stars, particles): `const rand = random("stars")` gives a seeded generator of numbers in [0, 1), so every build is the same. Never `Math.random()`.
- **Something draws itself**: `draw={track(0).to(1, span(…))}` on a `<Shape>`, an `<Arrow>`, a chart series.
- **Two layouts of one picture** (chart values, before/after code): `morph` between keyed states, not hand-written tracks per node.
- **A changing number**: `count()` in a `<Text>`; a label that changes at times (a state badge, a year): a string track in a `<Text>`. Never texts crossfaded per value.
- **Typing**: `typed(track("").to("Save drafts", span(0.2, 1)))`, never a `<Run>` per letter faded in.
- **One number drives many props**: one track and `.map()` from it, not parallel tracks that can drift apart.
- **A card or a pill**: a container with `fill`, `stroke` and `radius`, not a rect of a size you worked out.
- **A label on a shape**: `<Center>`. **Against the canvas or another node**: `<Align>` or a ref's anchor.
- **Arrows between nodes**: `<Arrow from={a.right} to={b.left}>`. A token riding along: a point track whose steps go to anchors.
- **Never two movers on one prop**: a prop is a value, a track, or a derived value, and a morph moves what a state leaves free.

## Check, look, fix

Never call a scene done from its source. Run these, in order, after every change:

```sh
npx tsc --noEmit
npx svjeez check scene.tsx                  # the model and the SVG it emits: problems, lanes, cost; no browser
npx svjeez check scene.tsx --at 0,1.5       # also what is on screen at those seconds, and what moves it
npx svjeez frames scene.tsx --sheet --out frames/   # look: open frames/sheet.png
```

1. Plan the beats as spans first. Fix type errors, then every `check` error: a scene that throws while it builds is one `compile-error` at the line of the node that is wrong, with a `fix:` line.
2. Read each warning, open a frame at the times it names, and fix the scene unless the frame shows what you meant. `info` is advice. Key the nodes you will read so messages name them.
3. Render a sheet at the start, middle and end of each beat (`--times 0,0.4,1.2`), in `--color-scheme light` and `dark`: things arrive and leave on cue, nothing is off center or clipped, text is legible, the last frame flows into the first.
4. `--browser` adds a pixel pass in headless Chromium; `--json` prints the report. It exits 1 on any error. A problem is `file:line:column  code  severity: message` then `fix:`. After the count line, `cost:` is the running animations and the area of filters redrawn every frame, and `lanes:` is how many animated lanes CSS carries and how many SMIL (geometry, filters and gradients; SMIL can't follow a scroll timeline). Prefer CSS lanes. Detail: [`references/check.md`](references/check.md).

| Code | Means |
| --- | --- |
| `type-error` | TypeScript rejects the file (the single-file `svjeez` binary checks types itself) |
| `compile-error` | the scene threw while it was built: the message says what to write |
| `compile-warning` | an SVG file or string the scene was given carries a warning |
| `never-visible` | a node hidden, painting nothing or covered at every time |
| `zero-size` | geometry, text or an image with no size |
| `off-canvas` | outside the canvas at every time (error), or cut by its edge at rest |
| `text-overflow` | text past the canvas at rest, or a line wider than its `width` |
| `overlap` | two texts drawn over each other while both are fully shown |
| `missing-glyph` | characters the font has no glyph for; no other font fills in |
| `low-contrast` | text or a thin line too close in color to the flat color behind it, per scheme |
| `loop-seam` | a looping scene jumps when it starts again: end where you started (`.rewind()`, `exit()`) |
| `visible-at-zero` | shown at 0s and cut straight back in, or filled while its stroke draws in |
| `nothing-enters`, `static`, `wasted-motion` | nothing enters; nothing moves; a value changes while no one sees it |
| `moving-filter` | a filter redrawn every frame because its parameters or its content move |
| `moving-box` | a `<Group>` placed by `at` or an anchor whose content moves, so the pin only holds at 0s; use `offset` |
| `layout-overlap` | two children of a `<Stack>` or `<Grid>` overlap: motion carried one onto another |
| `word-cut` | a word wider than the `width` its text wraps to, cut across two lines |
| `unsupported`, `approximate` | the SVG backend can't draw a feature, or draws it a little differently |

## Size and speed

What costs bytes: each font face a text uses (its glyph subset, usually most of a small file), sampled and derived curves that don't map key for key, springs, many nodes with lanes of their own. What is free: containers, refs, keys, anchors, `<Align>`, still values, and repeated still drawings (the SVG shares them). Use one family and two weights, let one track drive many props by `.map()`, animate `opacity`, `offset`, `scale` and `rotate` rather than geometry, paint or effects where either would do, and keep `blur` and `displace` still unless the blur is the point.

## Errors

Type errors:

| Message | Fix |
| --- | --- |
| `Type '"red"' is not assignable to type 'Anim<Paint> \| undefined'` | colors are `"#RRGGBB"` hex or tokens |
| `Type 'string' is not assignable to type 'Anim<Paint> \| undefined'` | the color sits in a `string[]` or a `string` field: type it `Color` from svjeez, or mark it `as const` |
| `Type 'number' is not assignable to type 'string'`, on `key` | a key is text: ``key={`dot-${i}`}`` |
| `Type 'string' is not assignable to type 'Anchor \| Anim<Vec> \| undefined'` | `at` is a point or an anchor; a place name goes in `anchor` |
| `Type 'string' is not assignable to type 'StrokeProps'` | `stroke={{ color: theme.text, width: 2 }}` |
| `Property 'font' is missing in type '…' but required in type 'TextProps'` | `<Text>` needs `font` and `size`, and a `fill` to paint |
| `Argument of type 'number' is not assignable to parameter of type 'Interval'` | steps take spans: `.to(1, span(0.5, 0.3))` |
| `Property 'rect' does not exist on type 'JSX.IntrinsicElements'` | there are no SVG tags: `<Shape geometry={rect(w, h)} />` |

Runtime errors. `…` stands for a value the message fills in.

| Message | Fix |
| --- | --- |
| `… has no font.` | `font={await font.load("Inter.ttf")}` or a family from `@svjeez/fonts`; nothing is inherited |
| `… takes a font made by font(), font.load(), font.family() or @svjeez/fonts, got ….` | pass a `Font` or `FontFamily`, not a name |
| `… has no geometry.` | give it `geometry`, such as `geometry={rect(40, 20)}` |
| `… paints nothing: it has no fill and no stroke.` | give it `fill` or `stroke` |
| `… draws "…" with no fill, so it paints nothing.` | `fill` on the `<Text>` or the `<Run>` |
| `… holds the bare text "…". Write text in a <Text font={…} size={…} fill={…}>.` | wrap strings in `<Text>` |
| `JSX holds <…>, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />.` | write components, and put the JSX pragma at the top of the file |
| `… holds a <Run>, which draws only inside a <Text>. Put it in one, as in <Text font={…} size={…} fill={…}>a <Run weight={600}>bold</Run> word</Text>.` | put the `<Run>` in a `<Text>` |
| `… has its own …, but the … it sits in places it.` | a container places its children: drop `at`, or nudge with a layer's `offset` |
| `… has both at and offset. at puts a point of its box somewhere; offset moves its own [0, 0] there.` | keep one: `offset` to move the node's own frame, `at` for a point of its box |
| `anchor on … names the point its at places, but it has no at, so it stays where its coordinates put it.` | give the node an `at`, or drop `anchor` |
| `… is a ref that is on no node.` | put the ref on a node the scene draws |
| `A ref is on two nodes, … and ….` | one ref per node |
| `Two nodes are both keyed "…"….` | keys are unique among siblings; `key` is a string or a number (`key={year}`), and `1` and `"1"` collide (unkeyed siblings are keyed `#0`, `#1`… by position, so they never collide with yours) |
| `Two steps move … at once: one …, and another …, before the first ends.` | start the second step when the first ends (`first.next(over)`) |
| `… and … read the same track, but they count time on different clocks: … and ….` | make a track per clock, or put both nodes in one `<Sequence>` |
| `A track starts at a value, but track(…) starts at an anchor.` | `track([0, 0]).to(anchor, span)`: start at a point |
| `… goes to an anchor, but the … it sits in places it.` | a container's child can't follow an anchor: wrap it in a `<Group>` |
| `to() takes a span, got …. Write .to(value, span(start, over)); a step right after another is span.next(over).` | pass a span |
| `The spring on … from …s needs …s to settle, but its span is …s. Give it a longer span, a stiffer or more damped spring, or cut it with a later step.` | make the span `spring.settle` long |
| `… runs until …s…, past the …s scene. End it by then, or give scene() a longer duration.` | end it sooner, or a longer `duration` |
| `rewind(…) on … needs the last …s of its …s clock, but the motion runs until …s.` | a shorter rewind, or end the motion earlier |
| `loop(…) is shorter than the motion, which runs until …s.` | a longer period |
| `motion on … takes layers: plain objects of offset, rotate, scale, skew and opacity, each a value or a track.` | `motion={{ opacity: track(0).to(1, span(1, 0.3)) }}`, or `enter()`, `exit()`, `wiggle()` |
| `A motion layer holds offset, rotate, scale, skew and opacity, and … gives it "…".` | keep those five keys; put the rest on the node |
| `… has both draw and trim, but draw is trim [0, draw].` | give `draw` or `trim`, not both |
| `morph() matches nodes by key, and … the states have … nodes with no key, so they would pair up by their place.` | `key` every node that comes, goes or changes |
| `morph() can't turn the node keyed "…" from a … into a …: a node keeps its kind across states.…` | another key for the other kind |
| `… lays out …, which a morph() resizes, brings in or takes away inside a <Sequence>, so the … can't make room for it.` | put the container inside the `<Sequence>` |
| `… is … …, but its children… and padding need ….` | a larger `width` or `height`, or leave it out |
| `A child of … is keyed "background", which names the container's own fill and stroke.` | give the child another key |
| `… holds … count()s, and a <Text> counts one number.` | a `<Text>` per number, side by side in a row |
| `numeral() takes decimals from 0 to 10, got ….` | a whole number of decimals |
| `subtract() cuts holes that lie wholly inside the base or wholly outside it, and … crosses or touches the base's edge. Draw that outline with path() instead.` | draw that outline with `path()` |
| `… has …, which spreads over the node's box, and this paint has no box to spread over. Give the gradient its points: …` | `linear({ from, to, stops })` |

## Detail

- Tracks, layers and stacking, recipes, springs, derived and sampled values: [`references/motion.md`](references/motion.md)
- Spans, clocks, `<Sequence>`, loops and seams: [`references/time.md`](references/time.md)
- Containers, text, runs and counting numbers: [`references/layout-text.md`](references/layout-text.md)
- Refs, anchors, parts and `<Arrow>`: [`references/refs-arrows.md`](references/refs-arrows.md)
- Paint, clip, mask, effects: [`references/paint.md`](references/paint.md)
- Morphing between states: [`references/morph.md`](references/morph.md)
- The check report and every code: [`references/check.md`](references/check.md)
- SVG, frames, dev preview, video, embedding: [`references/render.md`](references/render.md)
- Params: [`references/params.md`](references/params.md)
- Fonts and pictures: [`references/fonts-pictures.md`](references/fonts-pictures.md)
- Icons, charts, code: [`references/icons.md`](references/icons.md), [`references/charts.md`](references/charts.md), [`references/code.md`](references/code.md)
- Diagrams, Mermaid, maps and globes, math: [`references/diagrams.md`](references/diagrams.md), [`references/mermaid.md`](references/mermaid.md), [`references/geo.md`](references/geo.md), [`references/math.md`](references/math.md)
- Vite and Astro: [`references/web.md`](references/web.md)

## Examples

Each one renders and passes `check` with no warnings. They share `examples/style.ts` (a token palette and Geist from `examples/fonts/`).

| File | Teaches |
| --- | --- |
| [`examples/hello.tsx`](examples/hello.tsx) | the scene above |
| [`examples/card.tsx`](examples/card.tsx) | `Stack`, `Center` and `Align`, wrapped text with `<Run>`s, a cascade of spans, `enter` and `exit` layers |
| [`examples/pipeline.tsx`](examples/pipeline.tsx) | refs and anchors, staggered `<Arrow draw>`, a dot whose `at` track goes to anchors |
| [`examples/chart.tsx`](examples/chart.tsx) | `morph.between` keyed states: bars grow, recolor, trade places, enter and leave |
| [`examples/progress.tsx`](examples/progress.tsx) | one track mapped to a ring's `draw`, a bar's geometry and a `count()`; a spring pop; a crossfade |
| [`examples/reveal.tsx`](examples/reveal.tsx) | gradients, a clip track, a soft mask sized by the node's box, `subtract`, a looped rotate |
| [`examples/steps.tsx`](examples/steps.tsx) | a component that takes a span prop, `<Sequence>` clocks, one track as the base of two chains |
