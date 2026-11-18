---
name: svjeez
description: Write animated SVGs with svjeez, a TypeScript library that compiles a scene of typed nodes, layout and motion into one self-contained animated SVG (and frames or video) with no runtime JavaScript. Use when asked to make, edit or debug an animated SVG, a svjeez scene, an animated UI mockup, explainer, chart or loader in TypeScript, or when a project imports svjeez.
---

# svjeez

A scene is a TypeScript file whose default export is `scene(options, build)`. `build` returns a tree of nodes (`<Shape>`, `<Text>`, `<Group>`, layout containers, `<Arrow>`); every prop takes a value or a track over time. svjeez lays it out, measures its text, checks it, and writes one animated SVG that plays with no JavaScript, in light and dark. You never write SVG: no transforms, ids, defs, path strings for shapes, or CSS.

## Setup

```sh
npm i svjeez@next @svjeez/fonts@next && npm i -D tsx typescript playwright-core && npx playwright-core install chromium-headless-shell
```

Under Bun: `bun add svjeez@next @svjeez/fonts@next` and run the CLI with `bunx --bun svjeez`. In `tsconfig.json` set `"jsx": "react-jsx"`, `"jsxImportSource": "svjeez"` and `"strict": true`, or start each scene file with the pragma below. Every import comes from `svjeez`.

```tsx
/** @jsxImportSource svjeez */
import { google } from "@svjeez/fonts";
import { Group, Shape, Text, canvas, circle, draw, ease, enter, path, scene, span, tokens } from "svjeez";

const theme = tokens({
  light: { background: "#F6F7F9", text: "#161A21", accent: "#2F6FEB" },
  dark: { background: "#0E1116", text: "#EEF1F5", accent: "#6EA2FF" },
});
const sans = await google("Inter"); // or font.load("fonts/Inter.ttf"): text is measured with the real face

export default scene({ size: [240, 140], duration: 4, title: "Hello", theme, reducedMotion: 2.5 }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Shape
      geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
      stroke={{ color: theme.accent, width: 4, cap: "round" }}
      trim={draw(span(0.2, 1.2))}
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
));
```

`scene()` takes `size` (`[width, height]`), `duration` (seconds of one loop), `title` (required, read by screen readers), `desc`, `theme` (tokens to declare even if unused), `loop` (`false` plays once and holds) and `reducedMotion` (the second a viewer who asked for less motion sees, held still; default 85% through, or `false`). The default export may also be a function that returns a scene, which is how a scene takes params ([`references/params.md`](references/params.md)).

## The model in eight rules

1. **Every node has a box**: what it paints, its stroke included, measured when the scene compiles. Text too.
2. **`at` places the node's `anchor`**, the box's top-left unless `anchor` names another point (`"center"`, `"bottom-right"`, `[0.5, 1]`, and for text `"baseline"`, `"baseline-left"`, `"baseline-right"`). A `<Group>` is a frame: its `at` is where its children's `[0, 0]` goes. A line, polygon or path with no `at` stays where its coordinates are. `rotate` and `scale` turn around `origin`, `"center"` of the box by default; `origin="at"` turns around the point `at` places, a group's `[0, 0]`.
3. **Nothing is inherited.** A shape with no fill has none; a text needs its own `font`, `size` and `fill`. Share styles by spreading objects or writing components.
4. **Every prop takes a value or a track**: `opacity={track(0).to(1, span(0.5, 0.3))}`. Geometry, paint, stroke width, trim, clip and effects animate the same way.
5. **Time is spans on clocks.** `span(start, over)` is when; build each beat from the one before (`a.next(0.4)`, `a.cascade(3, 0.1)`). `<Sequence start={…}>` starts a clock of its own.
6. **Layout containers place children.** `<Stack>`, `<Grid>`, `<Center>` and `<Align>` measure boxes and set each child's place; a child in one takes no `at`. `<Stack>`, `<Grid>` and `<Center>` also draw their own background, sized to what they hold. Prefer them to coordinates you compute.
7. **Refs name nodes.** `const card = ref("card")`, `<Group ref={card}>`, then `card.right`, `card.center`, `card.part("title")` from anywhere: arrows attach to them, `<Align to={card}>` places against them, and a `timeline()` moves them.
8. **Morph goes between keyed states.** `morph.between([a, b, c], spans)` matches nodes by `key`: one in both states moves, resizes and recolors; one only in the later state enters; one only in the earlier exits.

## Vocabulary

| Nodes | |
| --- | --- |
| `<Shape geometry fill stroke trim>` | `stroke={{ color, width, cap, join, dash }}`; `trim={[from, to]}` draws part of the outline |
| `<Text font size fill weight italic width lineHeight align>` | strings and `<Run weight fill italic opacity>` inside; `width` wraps |
| `<Group>` | a frame that moves its children together |
| `<Image src={picture(…)} width height>` | a PNG, JPEG, GIF, WebP or SVG embedded |
| `<Instance of={symbol(() => …)}>` | content drawn once, placed many times |
| `<Sequence start over timeline>` | a local clock: tracks inside count from `start` |
| `<Arrow from to stroke bend inset head trim>` | a line or arrow between points or anchors; follows them as they move |

Every node also takes `key`, `ref`, `at`, `anchor`, `origin`, `rotate` (degrees, clockwise), `scale`, `opacity`, `motion`, `clip`, `mask` and `effects`.

| Geometry (each a value; a track of them morphs) | |
| --- | --- |
| `rect(w, h, { radius })` | frame starts at its top-left; `radius` is one number or four corners |
| `circle(r)`, `ellipse(rx, ry)`, `arc({ radius, start, sweep })` | drawn around their own `[0, 0]`; angles are degrees clockwise from three o'clock |
| `line(a, b)`, `polygon(points)`, `polyline(points)` | stay where their points are unless given `at` |
| `path().moveTo(p).lineTo(p).curveTo(c1, c2, p).quadTo(c, p).close()` | build a path in code |
| `pathData("M0 0L10 0Z")` | read path data from an icon set or drawing tool |
| `subtract(base, ...cuts)`, `moved(geometry, [x, y])`, `canvas.rect`, `canvas.size`, `canvas.center` | holes; a geometry somewhere else; the scene's own rect and size |

| Paint | |
| --- | --- |
| `tokens({ light, dark })` | named colors with a light and a dark value; the SVG follows the viewer's scheme |
| `"#RRGGBB"`, `"#RRGGBBAA"` | a color that is the same in both schemes |
| `linear.across({ angle, stops })`, `radial.across({ center, stops })` | gradients spread over the node's box |
| `linear({ from, to, stops })`, `radial({ center, radius, stops })` | gradients at points in the node's frame |
| `clip={geometry}`, `mask={<Shape …/>}`, `effects={[blur(r), shadow({ color, offset, blur })]}` | in the node's own frame; `clip={(own) => moved(circle(20), own.center)}` and `mask={(own) => …}` are sized by the node's box; [`references/paint.md`](references/paint.md) |

| Motion | |
| --- | --- |
| `track(v).to(v2, span, curve?).set(v3, t).loop(p).repeat(n).rewind(over)` | a prop's value over time |
| `motion={[enter(span, { from }), exit(span, { to }), wiggle(amp, { seed }), shake(amp, span)]}` | layers around the node, first outermost: `offset`, `rotate`, `scale`, `opacity` |
| `motion({ offset: [0, 8] }).to({ offset: [0, 0] }, span)` | a layer of your own |
| `draw(span)` for `trim`, `spin({ every })` for `rotate` | recipes that return tracks |
| `ease.linear in out inOut pop hold steps(n) bezier(…)`, `ease.spring({ stiffness, damping })` | curves; a spring's `.settle` is how long it needs, and a verb given a spring for its length lasts that long |
| `theta.map((t) => …)`, `a.with(b).map((a, b) => …)` | derived tracks: one value drives many props |
| `sampled((t) => value, span, { tolerance })` | any function of time, fitted to few keys |
| `timeline(seq(…), par(…), stagger(step, …), wait(s))` with `ref.move`, `moveBy`, `rotate`, `scale`, `show`, `hide`, `fill`, `stroke`, `draw`, `to`, `set`, `rewind` | choreography over refs; `rewind` on a component's ref rewinds every part inside it |
| `morph(before, after, span)`, `morph.between(states, spans, { stagger, enter, exit, curve })` | state to state by key |

| Layout | |
| --- | --- |
| `<Stack direction gap align justify padding width height>` | children one after another; `align` places them across (`start`, `center`, `end`, `stretch`), `justify` along a fixed `width` or `height` (`space-between` too) |
| `<Grid columns gap justify align padding>` | rows of cells as wide as their widest child |
| `<Center padding width height>` | children laid over each other, centered: a label on a shape, a pill |
| `fill stroke radius` on `<Stack>`, `<Grid>`, `<Center>` | a background as big as the container, its stroke inside the box: a card, a window, a row |
| `<Align to place inset>` | places children against the canvas (default), a box, or a ref: `place="top-right"` puts each child's top-right on that corner |

Anchors on a ref: `center`, `left`, `right`, `top`, `bottom`, `topLeft`, `topRight`, `bottomLeft`, `bottomRight`, `side(edge, t)` and `.map(([x, y]) => …)`.

## One way to do each thing

- **A prop changes on its own schedule**: give the prop a track. `fill={track(theme.text).to(theme.blue, span(1, 0.3))}`.
- **A node arrives, leaves, wobbles or drifts**: a motion layer in `motion`. Layers multiply opacity and add offsets on top of the node's own props, so an entrance never fights a prop's track.
- **Several nodes act in an order that depends on each other** (a cursor reaches a button, then it presses): a `timeline()` of verbs on refs, written as a script. A component can return its refs' verbs as actions (`toggle.on`).
- **Two layouts of the same picture** (chart values, before/after code, a reflowing list): `morph` between keyed states, not hand-written tracks per node.
- **One number drives many props**: one track and `.map()` from it, not parallel tracks that can drift apart.
- **A card, a pill, a row with a background**: give the `<Stack>` or `<Center>` a `fill`, `stroke` and `radius`, not a rect of a size you worked out.
- **Centering a label on a shape**: `<Center>` around both, not `at` arithmetic.
- **A prop moves in one place only**: a track, a timeline verb or a morph, never two of them. Each says so if you mix them.

## Render, look, fix

Never call a scene done from its source. Run these in order, every time you change it:

```sh
npx tsc --noEmit
npx svjeez check scene.tsx --no-browser            # the model's findings, at once, with file:line and a hint
npx svjeez check scene.tsx --no-browser --at 0,1.5  # what is on screen at those seconds, and what moves it
npx svjeez frames scene.tsx --sheet --out frames/   # look: open frames/sheet.png
```

1. Pick `duration` and plan the beats as spans first.
2. Fix type errors, then every `check` error. A scene that throws while it builds is a `compile-error` at the line of the node or call that is wrong, naming it (`<Shape> "dot"`, `the head of <Arrow> "link"`), with what to change as its hint; the table below says what each means. A `SceneError` from `svjeez/tools` carries the same: `problem`, `fix`, `node` and `source`.
3. Read each warning, open a frame at the times it names, and fix the scene unless the frame shows what you meant. `info` is advice.
4. Use `--at` to confirm what the picture is at a beat: each node's key, kind, box, fill and what is changing. Give nodes you will read a `key` so the output names them.
5. Render a sheet at the start, middle and end of each beat (`--times 0,0.4,1.2`) in `--color-scheme light` and `dark`, and look: things arrive and leave on cue, nothing off center or clipped, text legible, the last frame flows into the first.

`svjeez check` without `--no-browser` also measures the SVG in headless Chromium. `--json` prints `{ errors, warnings, info }` (and `frames`, `timeline` with `--at`). It exits 1 on any error. Details: [`references/check.md`](references/check.md). Writing the SVG, video and the live preview: [`references/render.md`](references/render.md).

| Finding | Means |
| --- | --- |
| `compile-error` | the scene threw while it was built: the message says what to write |
| `off-canvas` | outside the canvas at every time (error), or cut by its edge at rest |
| `text-overflow` | text past the canvas at rest, or a line wider than its `width` |
| `overlap` | two texts drawn over each other while both are fully shown |
| `layout-overlap` | two children of a `<Stack>` or `<Grid>` overlap: motion carried one onto another |
| `word-cut` | a word wider than the `width` its text wraps to, cut across two lines |
| `missing-glyph` | characters the font has no glyph for; no other font fills in |
| `low-contrast` | text or a thin line too close in color to the flat color behind it, per scheme |
| `never-visible`, `zero-size` | a node hidden, painting nothing or covered at every time; geometry with no size |
| `visible-at-zero` | shown at 0s and cut straight back in, or filled while its stroke draws in |
| `loop-seam` | a looping scene jumps when it starts again: end where you started (`.rewind()`, `exit()`); a node that enters must leave, and an arrow follows what its ends are attached to |
| `static`, `nothing-enters`, `wasted-motion` | nothing moves; nothing enters; a value changes while no one sees it |
| `unattached-ref`, `hidden-target`, `unused-symbol` | a ref no node takes; a timeline moving a node never seen; a symbol never placed |
| `unsupported`, `approximate` | the SVG backend can't draw a feature, or draws it a little differently (a blur below about 1.5) |

## Detail

- Layout containers, text, runs and fonts: [`references/layout-text.md`](references/layout-text.md)
- Tracks, layers, recipes, springs, derived and sampled values: [`references/motion.md`](references/motion.md)
- Refs, timelines and sequences: [`references/timeline.md`](references/timeline.md)
- Morphing between states: [`references/morph.md`](references/morph.md)
- Images, symbols and loading fonts: [`references/images-fonts.md`](references/images-fonts.md)

## Examples

Each one renders, passes `check` with no warnings, and is the bar for idiomatic code. They share `examples/style.ts` (a token palette and Geist from `examples/fonts/`).

| File | Teaches |
| --- | --- |
| [`examples/card.tsx`](examples/card.tsx) | a card that draws itself from `Stack`s, wrapped text with `<Run>`s, rows entering on a cascade of spans, `<Center>` pills |
| [`examples/toggles.tsx`](examples/toggles.tsx) | a timeline of verbs on refs: a cursor turns switches on; components that return their own actions; a spring; rows spread with `justify="space-between"` |
| [`examples/chart.tsx`](examples/chart.tsx) | `morph.between` keyed states: bars grow, recolor, trade places, enter and leave |
| [`examples/pipeline.tsx`](examples/pipeline.tsx) | a diagram: arrows attached to refs, staggered draws, a dot carried along anchors |
| [`examples/upload.tsx`](examples/upload.tsx) | one progress track mapped to a ring's trim and a bar's geometry; a spring pop; two labels crossfading |
| [`examples/reveal.tsx`](examples/reveal.tsx) | gradients, a growing clip, a soft mask wipe sized by the text's box, `subtract`, `spin` |

## Size

The SVG carries what the model needs and no more. What costs bytes: each font face a text uses (a subset of its glyphs, usually most of the file), sampled and derived curves that don't map key for key, springs (a few keys per move), and many nodes moving on lanes of their own. What is free: layout containers (one rect for one that draws itself), refs, keys, anchors and `<Align>` (they are resolved when the scene compiles), groups that only place, and a still value. Use one or two faces, let one track drive many props by `.map()`, and prefer an `<Instance>` for content drawn many times.

## Errors

Type errors:

| Message | Fix |
| --- | --- |
| `Type '"red"' is not assignable to type 'Anim<Paint> \| undefined'` | colors are `"#RRGGBB"` hex or tokens |
| `Type 'string' is not assignable to type 'Anchor \| Anim<Vec> \| undefined'` | `at` is a point or an anchor; a place name goes in `anchor` |
| `Type 'string' is not assignable to type 'StrokeProps'` | `stroke={{ color: theme.text, width: 2 }}` |
| `… is not assignable to type 'IntrinsicAttributes & TextProps'`, then `Property 'font' is missing in type '…' but required in type 'TextProps'` | the second line names the prop: `<Text>` needs `font` and `size`, and a `fill` to paint |
| `Argument of type 'number' is not assignable to parameter of type 'Span'` | steps take spans: `.to(1, span(0.5, 0.3))` |
| `Property 'rect' does not exist on type 'JSX.IntrinsicElements'` | there are no SVG tags: `<Shape geometry={rect(w, h)} />` |

Runtime errors. `…` stands for a value the message fills in.

| Message | Fix |
| --- | --- |
| `… holds …, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />.` | write components, and put the JSX pragma at the top of the file |
| `… holds the bare text "…". Write text in a <Text font={…} size={…} fill={…}>.` | wrap strings in `<Text>` |
| `… has no geometry.` | give it `geometry`, such as `geometry={rect(40, 20)}` |
| `… paints nothing: it has no fill and no stroke.` | give it `fill` or `stroke` |
| `… draws "…" with no fill, so it paints nothing.` | `fill` on the `<Text>` or the `<Run>` |
| `… draws … in …, which has no glyph for ….` | a font that has the character, or leave it out |
| `… asks for …, which its family doesn't have: it has ….` | load that weight or style into `font.family(…)` |
| `… has an at of its own, but the … it sits in places it.` | a container places its children: drop `at`, or nudge it with a motion layer's offset |
| `<Align> places itself against its to, so it takes no ….` | move it with `inset` and `place` |
| `… takes a place, one of …, got "…".` | one of the nine places, such as `"top-left"` |
| `anchor on … names the point its at places, but it has no at, so it stays where its coordinates put it.` | give a line, polygon or path an `at`, or drop `anchor` |
| `… names the ref "…", which is on no node.` | put the ref on a node |
| `… moves the ref "…", which is on no node.` | put the ref on a node the scene draws |
| `The ref "…" is on two nodes, … and ….` | one ref per node |
| `Two nodes are both keyed "…"…` | keys are unique among siblings |
| `… moves …, which is placed at …. Place it at a point and move() it to the anchor instead.` | `at` a point, then `move(anchor, …)` |
| `… moves …, but the … it sits in places it. Wrap it in a <Group> for the container to place, and move the node inside.` | move what is inside the container's child |
| `… moves … on … …, and … moves it too …, before the first one ends.` | one action per prop at a time: start the second when the first ends (`seq()`), or move both props in one `to()` |
| `… sets … on … …, while … is still moving it ….` | `set()` after the move ends, or end the move sooner |
| `… moves … on …, which a track already moves.` | a prop moves by a track or a timeline, not both |
| `… moves … on …, which has none. Only … nodes have ….` | `draw` and `fill` need a shape: put the ref on the shape |
| `… moves …, which sits inside …, but its timeline runs on the scene's clock.` | `<Sequence start={…} timeline={…}>` |
| `timeline() is only known while scene()'s callback runs.` | call `timeline()` inside `scene()`'s callback or a component |
| `canvas is only known inside scene()'s callback.` | read `canvas` inside the callback |
| `to() takes a span, got …. Write .to(value, span(start, over)); a step right after another is span.next(over).` | pass a span |
| ``Two transitions move `…` between …s and …s.`` | one `.to()` per stretch of time, or two layers |
| `The spring on … from …s needs …s to settle, but its span is …s.` | make the span `spring.settle` long |
| `… moves on a spring, and a spring moves only numbers and points. Use an ease such as ease.out.` | colors take an ease |
| `… runs until …s…, past the …s scene. End it by then, or give scene() a longer duration.` | end it sooner, or a longer `duration` |
| `rewind(…) on … needs the last …s of its …s clock, but the motion runs until …s.` | a shorter rewind, or end the motion earlier |
| `loop(…) is shorter than the motion, which runs until …s.` | a longer period |
| `morph() matches nodes by key, and … the states have … nodes with no key, so they would pair up by their place.` | `key` every node that comes, goes or changes |
| `morph() can't turn the node keyed "…" from a … into a …: a node keeps its kind across states.` | another key for the other kind |
| `… lays out …, which a morph() resizes, brings in or takes away inside a <Sequence>, so the … can't make room for it.` | put the container inside the `<Sequence>` |
| `… is … …, but its children… and padding need ….` | a larger `width` or `height`, or leave it out |
| `A child of … is keyed "background", which names the container's own fill and stroke.` | give the child another key |
| `… rewinds …, but no timeline moves it or anything inside it.` | move it or a part of it before rewinding, or drop the rewind |
| `A … holds morphs on different spans or with different options, and it reflows with one morph at a time.` | the same states, spans and options for every morph in one container |
| `… is given a spring for its length and a curve as well.` | pass the spring once, in place of the length |
| `The … of … is sized by its box, but … inside it is placed by an anchor…` | size the clip with numbers, or move that node out |
| `subtract() cuts holes that lie wholly inside the base or wholly outside it, and … crosses or touches the base's edge.` | draw that outline with `path()` |
| `… has …, which spreads over the node's box, and this paint has no box to spread over.` | give the gradient points: `linear({ from, to, stops })` |

## References

[`references/layout-text.md`](references/layout-text.md), [`references/motion.md`](references/motion.md), [`references/timeline.md`](references/timeline.md), [`references/morph.md`](references/morph.md), [`references/paint.md`](references/paint.md), [`references/check.md`](references/check.md), [`references/params.md`](references/params.md), [`references/images-fonts.md`](references/images-fonts.md), [`references/render.md`](references/render.md).
