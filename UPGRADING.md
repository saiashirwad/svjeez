# Upgrading from 0.7 to next (0.8.0-next)

`next` replaces the authoring API with the scene model. Nothing from 0.7's root carries over unchanged, so port a scene rather than patch it. Install with `npm i svjeez@next`, along with `@svjeez/fonts@next`, `@svjeez/icons@next`, `@svjeez/charts@next`, `@svjeez/code@next`, `@svjeez/dom@next`, `@svjeez/geo@next`, `@svjeez/video@next`, `@svjeez/vite@next` or `@svjeez/astro@next` if you use them.

- **One import.** The scene model moved to the root: what came from its subpath now comes from `svjeez`, and its tools subpath is `svjeez/tools`. `"jsxImportSource": "svjeez"` builds scene nodes, so drop the scene pragmas.
- **No SVG tags.** JSX holds components (`<Shape>`, `<Text>`, `<Group>`, `<Stack>`, `<Grid>`, `<Align>`, `<Arrow>`, `<Image>`, `<Sequence>`). `render(options, <svg JSX/>)` becomes `export default scene({ size: [w, h], duration, title }, () => …)`.
- **Time.** `motion()` chains, `animation={…}`, `<Clip>`, `<Once>`, `<Ambient>`, `<Pivot>` and `show()` are gone. Animate a prop with a `track`, a node with a `motion` layer or a recipe (`enter`, `exit`, `draw`, `wiggle`, `shake`, `spin`, `sampled`), and sequence refs with `timeline()`.
- **Removed outright.** `def`, `css`, `fx`, `Picture` (use `<Image src={picture(…)}>`), `Glyphs`, `Icon`, ink, the extras (`code`, `terminal`, callouts, themes; use `tokens()`), `Drawn`, `valuesAt`, `svjeez/geometry` and the public `render()`. A module may still default-export an SVG string.
- **Packages.** diagrams, math, mermaid, live, react and svelte stay on 0.7 until they are ported. The CLI's `values` and `set` are gone with the editor.
- **@svjeez/geo.** `project(data, { size })` draws from `[0, 0]` and returns geometry for `<Shape>`: `land`, `borders` (shared edges only; 0.7's `lines`), `sphere`, `graticule()`, `shape()` (0.7's `path()`), `route()`, `point()`, `dots()`, and `regions`/`region()` with `geometry`, `center` and `box`. `globe(data, { radius, facing, turn: { by, over } })` replaces `globe(span, data, { frame, tilt, spin })`: it is drawn around `[0, 0]`, and `<GlobeShape of={earth.land}>` draws what turns. `choropleth`, `cartogram`, `toBars`, `traffic`, `arc`, `reproject`, `trueSize`, the color scales and `legend` are gone: fill each region yourself, and morph a region's geometry with a track.
- **restyle.** `onceAt` is gone, and a scene with a morph, a geometry that changes size or an animated effect can't follow a `timeline`.

# Upgrading svjeez from 0.5 or 0.6 to 0.7

0.7 replaces several older APIs. Apply the steps that match your scenes, including the final 0.7 API section for motion chains and component results.

## How to use this

1. Bump `svjeez` and every `@svjeez/*` package the project uses to 0.7. npm has `vite`, `astro`, `charts`, `code`, `fonts`, `geo`, `icons`, `math` and `mermaid` up to 0.6.1. `@svjeez/diagrams`, `@svjeez/video` and `@svjeez/live` are new and were never on npm; install `diagrams` only if the project uses what moved there (step 2), and `code` is already a dependency if it highlights.
2. Before editing, render the project's scenes and keep the frames: `svjeez frames <scene> --sheet --out before/`, or the project's own build.
3. Apply the steps. Run the project's typecheck after each group, since every removed name is a type error.
4. Render again into `after/` and compare the frames. Differences are expected only where a step says so (step 8).

## Imports and packages

**1. `svjeez/extras` is gone.** Search `from "svjeez/extras"`. Everything that stayed is exported by `svjeez`. Names listed in steps 2 and 3 go elsewhere.

```ts
- import { Callout, timeline, terminal } from "svjeez/extras";
+ import { Callout, timeline, terminal } from "svjeez";
```

**2. Diagrams moved to `@svjeez/diagrams`.** Search `flowchart`, `sequence`, `lanes`, `tree`, `stateMachine` and their types (`Flowchart`, `FlowchartOptions`, `FlowchartEdge`, `FlowchartGroup`, `Sequence*`, `Lanes*`, `Lane*`, `Tree`, `TreeOptions`, `TreeSpec`, `State*`, `StateMachine`, `Walk`, `WalkToken`, `Diagram`, `DiagramOptions`, `Anchor`, `Labelled`, `NodeRole`). Import them from `@svjeez/diagrams`. Behavior is unchanged.

**3. Editor palettes moved to `@svjeez/code`.** Search `tomorrowNight`, `tomorrow`, `solarizedDark`, `solarizedLight`, `gruvboxDark`, `gruvboxLight`. Import from `@svjeez/code/palettes`, which does not load Shiki. `defaultDark`, `defaultLight`, `systemDark`, `systemLight`, `base16`, `tint`, `adaptive` and `variables` stay in `svjeez`.

**4. Two functions changed entry.** `restyle`, `RestyleOptions`: import from `svjeez/page`. `validateSvg`, `ValidationResult`: import from `svjeez/frames`. `render` already validates, so a `validateSvg(render(...))` call can often go.

## Renames

**5. `Values` is `ChannelValues`** (type). Search `\bValues\b` imported from `svjeez`.

**6. From 0.5 only**, since 0.6 already used the new names:

| 0.5 | 0.7 |
| --- | --- |
| `read` | `readingTime` |
| `window` | `appWindow` |
| `state` | `stateMachine` (in `@svjeez/diagrams`) |
| `Token`, `Tokens`, `Run`, `Piece`, `Word`, `Metrics` | `CodeToken`, `CodeTokens`, `CodeRun`, `CodePiece`, `CodeWord`, `CodeMetrics` |
| `Role` | `CodeRole` |
| `Command` (of `terminal`) | `TerminalCommand` |
| `FlowEdge`, `FlowGroup` | `FlowchartEdge`, `FlowchartGroup` |
| `TreeDiagram` | `Tree` |

**7. `fx.blur` takes an options object.** Search `fx.blur(`.

```ts
- fx.blur(6)
+ fx.blur({ by: 6 })
```

## Time

One model: a span (`{ at, over }`) says when, and `show` turns spans into visibility.

**8. `during`, `cut`, `visible`, `tl.show`, `tl.enter` are `show`.** Search each identifier; `tl` is any `timeline()` result.

```ts
- during(span, 0.3)          + show(span, { fade: 0.3 })
- cut(span)                  + show(span, { fade: 0 })
- visible(spans, 0.15)       + show(spans, { fade: 0.15 })
- tl.show("intro")           + show(tl.intro, { fade })   // fade: the timeline's own fade option, 0.3 if unset
- tl.enter("intro")          + show({ at: tl.intro.at }, { fade })   // no `over`: stays to the end
```

Needs judgment: `show` takes one span or a list, merges overlaps, and keeps both fades **inside** the span. `visible` faded in inside the span but faded out after it ended, so each of its spans now ends `fade` seconds earlier. Where a fade-out must stay where it was, widen the span: `{ at, over: over + fade }`. `show` defaults to `fade: 0.3` where `visible` defaulted to 0.15, so pass the fade explicitly. A span shorter than two fades shrinks its fades. `show([])` hides the element.

**9. `during` is `show` on annotations and stops.** Search `during:` and `during=`. Props of `Arrow`, `Brace`, `Callout`, `Underline`, and of each stop passed to `Focus`, `Marker` and `Camera`. The value is the same span.

```tsx
- <Callout target={box} during={{ at: 2, over: 3 }}>Click</Callout>
+ <Callout target={box} show={{ at: 2, over: 3 }}>Click</Callout>
```

**10. `sampled` and `readout` take a leading span.** Search `sampled(`, `sampled.path(` and `readout(`. The span is `{ at, over }`, with `at` required (it was 0 by default, and `duration` before that). `sampled`'s function still receives time from 0 to `over`.

```ts
- sampled(fn, { duration: 4, tolerance })                +  sampled({ at: 0, over: 4 }, fn, { tolerance })
- sampled(fn, { at: 2, over: 4, step, tolerance })       +  sampled({ at: 2, over: 4 }, fn, { step, tolerance })
- sampled.path(fn, { over: 6, tolerance })               +  sampled.path({ at: 0, over: 6 }, fn, { tolerance })
- readout(text, { at: 1, over: 3, step, x, y, fill })    +  readout({ at: 1, over: 3 }, text, { step, x, y, fill })
```

`SampleWindow` is gone: pass a `Span`. `readout` also throws the shared `needs a start of 0 or later` and `needs a positive over` errors.

**11. Results carry a `span`, not `end`.** Search `.end` on the results of `typewriter`, `terminal`, `reveal`, `flow`, `morph` and the `@svjeez/charts` series (`bars`, `line`, `area` of `chart(...)`). Use `.span.end` (also `.span.at`, `.span.over`). `timeline()` keeps its own `.end`.

```ts
- const next = typewriter(...).end + 0.5;
+ const next = typewriter(...).span.end + 0.5;
```

**12. Tools take scene seconds.** `svjeez frames --times`, `restyle({ at })` and `seek(time)` used playback seconds. They now use the seconds your motions are written in. The numbers are the same unless the scene sets `render({ playbackRate })` other than 1: then multiply each old playback time by `playbackRate`. Check scrub, poster and scroll code that calls `seek` or `restyle`.

**11b. `<Icon>` and `IconData` come from `@svjeez/icons`** on `next`, not `svjeez`. The tabler and lucide path data are unchanged. `<Icon icon={rocket} color={theme.text} size={48} />` replaces `x`, `y`, `stroke`, `fill`, `strokeWidth` and `animation`: `color` paints either kind, `at` places it, `width` is the outline width in grid units, and `trim={(piece) => draw(…)}` replaces `animation={(_, each) => draw(…)}`.

## Escape hatches

**13. `def.property` is `css.property`.** Same arguments. `def` keeps gradients, clips, masks, markers, symbols and filters.

**14. `calc` is gone.** Search `calc.` and `calc` imported from `svjeez`. Write the CSS `calc()`, `clamp()`, `sin()` yourself inside `css`, with properties and numbers in the holes. Wrap existing CSS text in `css.text()` when composing it with registered properties.

```ts
- const { add, mul, length, cos } = calc;
- css`.dot { translate: ${add(length(100), mul(length(60), reach, cos(yaw)))} 100px }`
+ css`.dot { translate: calc(100px + 60px * ${reach} * cos(${yaw})) 100px }`
```

**15. `el` is gone.** Search `el.` and `el` imported from `svjeez`. Use JSX, or `jsx(tag, props)` from `svjeez/jsx-runtime` in a `.ts` file, with children in the `children` prop. `ElementProps` is still exported.

```ts
- el.rect({ width: 10, height: 4 }, content)
+ <rect width={10} height={4}>{content}</rect>
+ jsx("rect", { width: 10, height: 4, children: content })
```

## Theme scoping (optional)

**16.** `variables(dark, light)` and `adaptive` styled every `svg` on the page. If the project inlines two scenes that use them, pass the `prefix` given to `render`: `variables({ dark, light, prefix })`, `adaptive({ dark, light, prefix })`. Without `prefix` nothing changes.

## Removed, no replacement

**17. Voxels.** Search `voxel` imported from `svjeez` (0.5), `svjeez/voxel` (0.6) or `@svjeez/voxel`. There is no replacement. Ask the user whether to keep a pre-rendered SVG of the scene, redraw it with plain shapes, or drop it. Do not guess.

## Only if the project ran an unpublished build of main

These were never on npm: 0.5.0 and 0.6.1 of `svjeez` and 0.6.1 of the `@svjeez/*` packages do not export them, and `@svjeez/math` 0.6.1 had only `tex`, `Tex`, `Glyph` and `Matrix`. Skip this section unless the code came from a git checkout of main and imports `@svjeez/math` beyond `tex`, `@svjeez/video`, `svjeez/params` or `svjeez/internal`.

| Search | Now |
| --- | --- |
| `axes(`, `Axes`, `AxesOptions`, `{ axes }` of `contours`, `contourSweep` | `plane`, `Plane`, `PlaneOptions`, `{ plane }` |
| `plane({ origin, unit, extent, step })` | `plane({ xRange, yRange, frame, ticks })`, see below |
| `Area`, `Curve`, `Dot`, `Line` (calculus), `MorphCurveOptions` | `CalculusArea`, `CalculusCurve`, `CalculusDot`, `CalculusLine`, `CalculusMorphOptions` |
| `sample`, `SampleOptions` | `valuesAt`, `ValuesAtOptions` |
| `<Pivot at>` | `<Pivot origin>` |
| `<Steady at>` | `<Camera steady origin>` |
| `flow(points, { loop })` | `flow(points, { period })` |
| `fieldFlow(lines, options)` | `flow(lines, options).node` |
| `sampledPath(fn, options)` | `sampled.path({ at, over }, fn, options)` |
| `sampled.path` with `duration` | `sampled.path({ at, over }, fn, { tolerance })` |
| `globe(data, { spin: { over } })`, `Globe.duration` | `globe(span, data, { spin })`, `Globe.span` (see API cleanup) |
| `.end` of `derive`, `epicycles`, `traffic`, `walk`, constructions | `.span.end` |
| `renderVideo` (`@svjeez/video`) | `video` |
| voxel block `at`, `from`, `to` | gone with voxels (step 17) |
| `fit`, `positionOf`, `valueAt`, `fitValues`, `withValues`, `follow` from `svjeez/params` | `@svjeez/live` |
| `el` from `svjeez/internal` | JSX (step 15) |

`axes` and `plane` are one coordinate system now, in `@svjeez/math`. For the old `plane({ origin, unit, extent, step })`, with `extent` as `{ x: [x0, x1], y: [y0, y1] }`:

```ts
- plane({ origin: { x: ox, y: oy }, unit: u, extent: { x: [x0, x1], y: [y0, y1] }, step: s })
+ plane({
+   xRange: [x0, x1],
+   yRange: [y0, y1],
+   // the plot area: its top-left is where the graph's (x0, y1) corner sits
+   frame: rect(ox + x0 * u, oy - y1 * u, (x1 - x0) * u, (y1 - y0) * u),
+   ticks: s,
+ })
```

`unit` was one scale for both axes, so the frame height uses it too. Check that the frame lands the graph origin on `origin`: `point(0, 0)` of the new plane should equal the old `origin`.

## API cleanup

Smaller breaking changes, in the order a typecheck will find them.

- `Timeline.duration` is gone. Use `tl.end`, or `tl.end - tl.at` for a length where the timeline starts at `at`. `timeline()` no longer takes `fade`, and a scene may now be named `duration`.
- `variables(dark, light?, { prefix })` is `variables({ dark, light?, prefix? })`, like `adaptive`.
- `hexBytes` and `hexOf` are no longer exported from `svjeez`, and neither is `groupBy`.
- `<Marker theme>` is gone: pass `color`. A marker now appears at its first stop's `show.at` instead of at 0.
- `systemDark` is darker: `base00` `#090A0C`, `base01` `#18181B`, `base02` `#27272A` (were `#1E1E20`, `#2A2A2D`, `#3A3A3D`). Re-render dark frames; pin the old hexes in your own palette if you need them.
- `Video.duration` (`@svjeez/video`) is `playTime`: playback seconds. `Scene.duration` stays in scene seconds.
- `<Focus fade={0}>` cuts instead of throwing.
- Geometry helpers moved to `svjeez/geometry`: `rect`, `resample`, `polylinePath`, `pathLength`, `matchPaths`, `num` and the types `MatchOptions`, `PolylinePathOptions`, `SampledPathOptions`. The types `Rect`, `Point`, `Edge` and `PathData` stay in `svjeez`.

```ts
- import { rect, render } from "svjeez";
+ import { render } from "svjeez";
+ import { rect } from "svjeez/geometry";
```

- Placement is a `frame: Rect` (`rect(x, y, w, h)` from `svjeez/geometry`), as `@svjeez/geo` already did. `chart({ width, height, at })` is `chart({ frame })`. `plane({ x, y, width, height, at })` is `plane({ xRange, yRange, frame })`. `vectorField`, `streamlines`, `contours` and `contourSweep` take `frame` where they took `bounds`, and `Bounds` is gone: pass a `Rect`. `construct({ at })` is `construct({ origin })`. `legend(scale, { x, y, width, height, ink })` is `legend(scale, { frame, color, theme })` and returns `{ node, bounds }`, so use `.node`. The text default is the theme's `plain` rather than `#c9d1d9`.
- Time is a leading span, with options last:

```ts
- c.bars(record, { at: 0.6, over: 0.7, stagger: 0.08 })   + c.bars({ at: 0.6, over: 1.1 }, record)  // over spans the whole series
- c.line(points, { at: 1, over: 2 })                      + c.line({ at: 1, over: 2 }, points)
- epicycles(outline, { at, over, ...rest })               + epicycles({ at, over }, outline, rest)
- derive(steps, { at, every: 2, over: 0.8 })              + derive({ at, over: 5 * 2 + 0.8 }, steps, { change: 0.8 })
- fieldLines(lines, { at, over })                         + fieldLines({ at, over }, lines)
- sampled(fn, { at, over, tolerance })                   + sampled({ at, over }, fn, { tolerance })   // also sampled.path
- readout(text, { at, over, x, y })                       + readout({ at, over }, text, { x, y })
- contourSweep(f, { at, over, from, to })                 + contourSweep({ at, over }, f, { from, to })
- counter(fn, { duration: 10, step })                     + counter({ at: 0, over: 10 }, fn, { step })
- plane.vector(to, { enter: span })                       + plane.vector(span, to)
- plane.basis({ enter: span })                            + plane.basis(span)
- cartogram(map, values, { at, over })                    + cartogram({ at, over }, map, values)
- toBars(map, values, { at, over, frame })                + toBars({ at, over }, map, values, { frame })
- traffic(lines, { during: span, rate })                  + traffic(span, lines, { rate })
- trueSize(map, region, to, { at, over, duration })       + trueSize({ at, over }, map, region, to)
- plane.apply(matrix, { at, over, ease })                 + plane.apply({ at, over }, matrix, { ease })
- plane.applyFunction(f, { at, over })                    + plane.applyFunction({ at, over }, f)
- plane.reset({ at, over, ease })                         + plane.reset({ at, over }, { ease })
- plane.riemann(f, { n, at: [5, 6], over: 0.7 })          + plane.riemann([{ at: 5, over: 0.7 }, { at: 6, over: 0.7 }], f, { n })
- plane.morph(fs, { at: [3, 4.5], over: 0.8 })            + plane.morph([{ at: 3, over: 0.8 }, { at: 4.5, over: 0.8 }], fs)
- globe(data, { spin: { from, to, over: 24 } })           + globe({ at: 0, over: 24 }, data, { spin: { from, to } })
- globe(data, { spin: fn, over: 24 })                     + globe({ at: 0, over: 24 }, data, { spin: fn })
- choropleth(map, values, { scale, times: [0.5, 3], over: 1 }) + choropleth([{ at: 0.5, over: 1 }, { at: 3, over: 1 }], map, values, { scale })
- choropleth(map, values, { scale, at: [0, 3] })          + choropleth(map, values, { scale, times: [0, 3] })
- { lane: "a", from: 1, to: 4 }                           + { lane: "a", at: 1, over: 3 }   // LaneSpan is LaneBar
```

  Details. A bar series now ends with its span: each bar grows for `over - (bars - 1) * stagger`, `stagger` defaults to 0.08 or less when the span is short, `ease` is an option, and `bars` also takes `[key, value]` pairs. `derive`'s `every` is gone: the changes are spaced evenly across the span and `over` became `change`. `counter(fn)` reads `fn` from 0 at the span's start, not at scene time 0. `plane.riemann` and `plane.morph` take one span per change after the first stage, and `choropleth` one span per value (the first with `over: 0` cuts to its colors, as `times: 0` did; a span with a length fades in from `scale.empty`). Spans must not overlap; `choropleth` no longer cuts a change short to fit. `globe` takes the span for all its motion: `spin` runs `from` to `to` across it, `Spin.at` and `Spin.over` are gone (hold or ease with a function `spin`), `facing(t)`, `locate(at, t)` and function arguments take seconds since `span.at`, and `Globe.duration` is `Globe.span`. `cartogram` and `toBars` with `stagger` start the shapes that far apart and land the last with the span. `trueSize` takes a core `Ease` and defaults to `ease.inOut`, a slightly different curve from the old cubic. `Timing` is gone from `@svjeez/math` and `@svjeez/charts`.
- Names. Types that two packages shared are prefixed with their package, and a few functions were renamed to say what they do:

| Package | Old | New |
| --- | --- | --- |
| `@svjeez/mermaid` | `parse` | `parseMermaid` |
| `@svjeez/mermaid` | `FlowNode`, `FlowEdge`, `Participant`, `SequenceMessage`, `StateTransition` | `MermaidFlowNode`, `MermaidFlowEdge`, `MermaidParticipant`, `MermaidSequenceMessage`, `MermaidStateTransition` |
| `@svjeez/mermaid` | `FORM_ROLES` | gone (the form-to-role table is in the README) |
| `@svjeez/diagrams` | `StateOptions`, `Transition` | `StateMachineOptions`, `StateTransition` |
| `@svjeez/diagrams` | `Checked`, `StateIds` | no longer exported |
| `@svjeez/math` | `plane.span(direction)`, `SpanOptions` | `plane.line(direction)`, `PlaneLineOptions` |
| `@svjeez/math` | `GeoPoint`, `GeoLine`, `GeoCircle`, `GeoCurve` | `ConstructPoint`, `ConstructLine`, `ConstructCircle`, `ConstructCurve` |
| `@svjeez/math` | `Look`, `Pace`, `LineOptions`, `PolygonOptions` (of `construct`) | `ConstructLook`, `ConstructPace`, `ConstructLineOptions`, `ConstructPolygonOptions` |
| `@svjeez/charts` | `Bar`, `Bars`, `BarsOptions`, `Line`, `LineOptions`, `Area`, `AreaOptions` | `ChartBar`, `ChartBars`, `ChartBarsOptions`, `ChartLine`, `ChartLineOptions`, `ChartArea`, `ChartAreaOptions` |
| `@svjeez/geo` | `Bar`, `Bars`, `BarsOptions` | `GeoBar`, `GeoBars`, `GeoBarsOptions` |

- A labelled edge is `[from, to, label?, options?]` in every diagram, with the label a string. A flowchart edge `[from, to, { label }]` is `[from, to, label]`. State transitions and sequence messages already were.
- `google.family(family, faces, options?)` takes faces as `{ weight, style }` objects. `options` is shared by every face and a face's own options override it; the first face's `fallback` is the family's. `GoogleFace` is gone, and a bare weight is `{ weight }`.

```ts
- google.family("Geist", [400, { weight: 600, style: "italic" }], { ligatures: false })
+ google.family("Geist", [{ weight: 400 }, { weight: 600, style: "italic" }], { ligatures: false })
```

- `defaultLight` is gone (use `systemLight`), and `inkPath` is no longer exported from `svjeez`.
- `@svjeez/code`: the palettes (`tomorrow`, `solarizedDark` and the rest) come from `@svjeez/code/palettes` only, and the root no longer re-exports `CodePiece`, `CodeRole` or `CodeTokens`: import those types from `svjeez`. Importing the package no longer loads Shiki until `highlight()` runs.
- `@svjeez/icons`: the root exports `Icon` and `IconData`; the `/tabler` and `/lucide` paths stay.
- `@svjeez/geo`: `nightfall` is gone, with no users. Use `globe().night(date)` on a globe, or `night(date)` with `map.path()` on a flat map.
- `@svjeez/fonts`: `cacheDir` is not exported. Set `SVJEEZ_FONTS_CACHE` to move the cache.
- `@svjeez/vite`: the `Options` type is `SvjeezOptions`.
- `@svjeez/diagrams`: `flowchart`, `tree`, `sequence` and `lanes` return `span`, from the first reveal to the end of the last (the instant 0 without `play`). The type behind it is `PlayedDiagram`.
- `svjeez video` calls `video` from `@svjeez/video` and no longer falls back to `renderVideo`.
- `svjeez/params` exports the `Range` and `Extras` types that `number`, `count` and `seconds` take.
- `@svjeez/live` (unpublished before 0.7): the `/controls`, `/editor` and `/gzip` paths are gone, so import `paramFor` and the rest from `@svjeez/live`. `measureMove` is not exported. The types `Picture`, `Grip` and `Stats` are `PictureState`, `GripState` and `PictureStats`, so they no longer clash with the components. `EditorOptions` is new.
- `@svjeez/svelte`: `editor(text, options)` is `new SceneEditor(text, options)`. The `Options` type of `@svjeez/react` and `@svjeez/svelte` is `EditorOptions`, defined in `@svjeez/live`.
- New exports, for typing what functions return: `FlowResult`, `TerminalResult`, `RevealResult`, `TypewriterResult`, `AppWindowResult`, `MorphResult`, `AdaptiveResult`, `VariablesResult`, `Shown`, `Heading` and `Travel`.
- These now throw: NaN or infinite `number`, `count` and `seconds` values and bounds; non-integer `count` bounds; duplicate `choice` options; a `color()` that is not hex; a `shake` or `wiggle` `rate` that is not positive; `restyle` `at` or `onceAt` below 0 or not finite; a non-finite `valuesAt` `duration`; `<Camera>` with no stops; `fx.boil` with a `seed` that is not a whole number of 1 or more or a `rate` that is not positive; `fx.grayscale` outside 0 to 1; `readingTime` with a non-positive `wps`. `recipes` and `sampled` say `needs a positive over` where they said `positive duration`.

## Final 0.7 API

### Time is spans, and motions have no cursor

A span is the one way to say when. A motion step is placed by a span or a time, never by a cursor: `.at()` and `.wait()` are gone, `.to(values, span, ease?)` takes a span and nothing else, and `.set(values, at)` takes the time of the cut. Every old form is a type error, and in plain JavaScript a runtime error that says what to write. Search the project for each identifier below, rewrite, then run the typecheck until it is clean.

- `.at(t).to(values, d, ease)` is `.to(values, span(t, d), ease)`. Search `.at(`. Where both numbers come from one span, `.at(s.at).to(values, s.over, ease)` is `.to(values, s, ease)`; where the length is an end minus a start, `.at(a).to(values, b - a, ease)` is `.to(values, span(a).until(b), ease)`.
- `.at(t).set(values)` is `.set(values, t)`. A `.set(values)` with no `.at` before it cut at the end of the step before it: write that span's `.end`, as in `.to(v, s).set(w, s.end)`, or `0` when it came first.
- A `.to(values, d)` with a number and no `.at` right before it started where the step before it ended. Search `.to(` whose second argument is a number or a length variable. After `.to(v, s)` it is `.to(values, s.next(d))`; first in the chain it is `.to(values, span(0, d))`. A run of them is `chain(first, ...lengths)`, new in `svjeez`, which returns `first` and one span per length, end to end: `.at(0.1).to(a, 0.3).to(b, 0.12).to(c, 0.25)` is `const [crouch, launch, rise] = chain(span(0.1, 0.3), 0.12, 0.25)` and `.to(a, crouch).to(b, launch).to(c, rise)`.
- `.wait(w)` between two steps is the gap of the next span: `.to(a, s).wait(w).to(b, d)` is `.to(a, s).to(b, s.next(d, w))`. A `.wait` before `.set` adds to the time: `.to(a, s).wait(w).set(b)` is `.set(b, s.end + w)`.
- A step built in a loop or a `reduce` that leaned on the cursor (`m = m.to(v, d)` with no `.at`) needs its spans made first: `chain(span(start, d1), d2, …)` when the lengths differ, or `stagger(span(start, d), n, d)` when they are equal. `chain` adds one length at a time as the cursor did, so the keyframes come out the same to the last digit; `stagger` multiplies, which can move a keyframe percentage in its last printed digit.
- Steps may be written in any order; each lane plays them in time order. Two steps that move one lane at once still throw `Two transitions move …`.
- `.repeat()` repeats the passage from the earliest step's start to the latest step's end. A trailing `.wait(w)` before `.repeat()` used to add a pause to every pass; there is no way to say that now, so the passes run back to back. Make the pause part of the passage with a step that holds a value, `.to(last, s.next(w))`, which costs a key per pass.
- `MotionData.cursor` is gone, for code that read a motion's data.
- `beats()` is gone. Use `stagger(first, count, step)` from `svjeez`, which returns `count` spans as long as `first`, each `step` after the one before. Where the code turned the times into spans, drop that step: `beats(1, n, 0.2).map((at) => ({ at, over: 0.5 }))` is `stagger(span(1, 0.5), n, 0.2)`. The `Beats` type stays, as what `reveal` and the diagrams' `play` take.
- Write stagger arithmetic as spans. Search `i * ` inside `at:` and `span(`: `items.map((item, i) => enter({ at: 1 + i * 0.08, over: 0.5 }))` is `const cascade = stagger(span(1, 0.5), items.length, 0.08)` and `items.map((item, i) => enter(cascade[i]!))`. A per-glyph or per-path callback is covered in the next section.
- Spans have `.until(end)` (same start, ends at `end`), `.first(over)` (starts with it) and `.last(over)` (ends with it). `{ at: a, over: b - a }` is `span(a).until(b)`, and `{ at: s.at + s.over - f, over: f }` is `s.last(f)`.
- `sequence().message(i).span` is a `Spanned`, so `.next()` and `.end` work on it.
- `@svjeez/live` reads both numbers of `span(at, over)`, the lengths given to `.next`, `.until`, `.first`, `.last` and `chain`, and the time of a `.set`, as seconds. A key that named the length of `.to(values, 0.5)`, `default:to.1`, is now the `over` of the span there, `default:span.1`.

A scene rewritten this way renders the same keyframes. A scene that still uses `.at`, `.wait`, `.to` with a number, `.set` with one argument or `beats` fails to typecheck.

### Per-glyph and per-path callbacks take `each`

`<Glyphs animation={fn}>` and `<Icon animation={fn}>` call `fn(piece, each)` where they used to call `fn(piece, index)`. `each` is `{ index, count, stagger(first, step) }` (type `Each`), so a cascade needs no arithmetic and no count. Search `<Glyphs` and `<Icon` for an `animation` that is a function:

- `(glyph, i) => draw({ at: i * 0.1, over: 1 })` is `(glyph, each) => draw(each.stagger(span(0, 1), 0.1))`.
- A callback that only needs the number is `(glyph, { index }) => …`.
- `each.count` counts every glyph of `text`, spaces included, the same numbering `index` always had. `<Icon>` counts paths.

### Seeded random and text fitting are in the library

- `random(seed)` from `svjeez` is the one seeded generator (mulberry32 for a whole number, hashed for a string). Delete a scene's own copy and import it. A hand-rolled Lehmer generator (`seed * 16807 % 2147483647`) gives different numbers than `random(seed)`; scatters built from one move when switched, so re-check the picture.
- `fitText(font, text, { width, max, min?, tail? })` returns the largest whole-pixel size, at most `max`, at which every line fits in `width`. `text` is a line or an array of lines, and `tail` is ems of extra room after the last line. Replace `while (font.measure(text, size) > width) size -= 2` loops with it; the result is exact to the pixel, not to a step of 2.
- `<Arrow>` takes `width` (stroke, default 1.5) and `head` (barb length, default 8). Replace a hand-built arrowhead made with `Math.atan2` by `<Arrow from to bend width head show />`.

### Params make a scene a template

`svjeez/params` gains `text(value, { maxLength? })`, `list(item, value, { min?, max? })` and `parse(schema, json)`, and every CLI command takes `--params data.json` and `--param key=value` (see `references/params.md`).

- `Param` is now `ScalarParam | ListParam`, and `ScalarParam` includes `TextParam`. Search `.kind` on a `Param` or a schema entry (`switch (p.kind)`, `p.kind === "choice"`): handle `"text"` (a string value) and `"list"` (an array of items, `p.item` the item schema), or skip them. Code that typed `Param["value"]` as a scalar now also sees `readonly ItemValue[]`.
- A scene module that exports `params` is now called with `defaults(params)` by the CLI, where it was called with nothing. A default export written `(p = defaults(params)) => …` renders the same. One that ignores its argument is unaffected.
- `packages/svjeez/scripts/preview.ts` is gone; the preview ships as `svjeez dev <file>`, and `bun run dev <file>` in `packages/svjeez/` and `examples/` runs it. Search `scripts/preview.ts` in scripts and replace `bun run scripts/preview.ts <file>` with `bun run src/cli.ts dev <file>`. It keeps the build in memory and writes `--out` only when given, so nothing lands in `.preview/`. `PORT` still works; `--port` is the flag, and a busy port moves to the next free one, so read the printed URL.

### Drawn results have parts

Every package that lays out at compile time now returns the same shape, `Drawn` from `svjeez`: `node`, `span`, `bounds`, `parts` and `part(id)`. A `Part` has `id`, `box` (a `Rect`) and `span`, when it plays. The old accessors for the same things are gone. Search each identifier below and run the typecheck after; every one is a type error.

- `@svjeez/charts`: `bars().bars` is `bars().parts`, and a bar's `key` is `id` and its `bounds` is `box`: `bars.bars.map((b) => b.bounds)` is `bars.parts.map((b) => b.box)`, and `bars.part("Q3")` finds one. `line().points` and `area().points` are gone; the points are `parts`, each with `point`, so `line.points` is `line.parts.map((p) => p.point)`. `ChartPoint` is the new type.
- `@svjeez/geo`: `map.regions` is `map.parts`, `map.region(key)` is `map.part(key)`, and a region's `bounds` is `box` (`map.bounds(region)` stays). `reproject()` renames the same way: `.regions` is `.parts`, `.region(key)` is `.part(key)`. `cartogram().bubbles` and `toBars().bars` are `.parts`, and a geo bar's `rect` is `box`. `choropleth()` now also returns `span`, `bounds`, `parts` (the regions `values` names) and `part(key)`.
- `@svjeez/math`: `tex().get(id)` is `tex().part(id).box`, and `tex().find(text, nth)` returns a part, so add `.box` where it was used as a `Rect`. `tex().write(span)` returns a `TexDrawn`, not a node: `{f.write(s)}` is `{f.write(s).node}`. Search `.write(` on formulas; a JSX child that is an object fails to typecheck.
- `@svjeez/diagrams` and `@svjeez/mermaid`: `diagram.get(id)` is `diagram.part(id).box`. Search `.get(` on anything a diagram or `mermaid()` returned; `chart.get("a").top` is `chart.part("a").box.top`. The `PlayedDiagram` type is gone: `Diagram<Id>` has `span` now, and so does `stateMachine()`, the instant 0.

New, nothing to migrate: each part has a real `span`. A bar's is its staggered window, a line point's starts when the stroke reaches it, a choropleth region's runs from the first span that changes its color to the end of the last, a written formula's part is when its glyphs write, and a diagram node's is when it pops in (the instant 0 for one there from the start). Place a callout after one lands with `enter(chart.part("q3").span.next(0.4))`. `flowchart()` and `tree()` also take a time per node id, `play: { at: { plan: 0.5, build: 1.4 } }`, besides a start or a list; the nodes it leaves out are there from the start.

Nothing renders differently.

### JSX takes a `Drawn` as a child, and more results are one

A `Drawn` goes into JSX as it is: `{bars}` draws `bars.node`, in JSX, in `jsx()` and as `render()`'s content. `.node` stays, so nothing has to change for this, but drop it where a chart, diagram, formula or map is placed as a child: search `.node}` and `.node,` and remove `.node` wherever the value came from `@svjeez/charts`, `diagrams`, `math`, `geo` or `mermaid` (including `tex().write(…).node`). Leave it on `flow()`, `appWindow()`, `code()`, `terminal()`, `typewriter()`, `morph()`, `legend()`, `epicycles()` and `chart()` itself, which are not a `Drawn`; inside `<g>` the typecheck says so, but fragment children are not checked.

These now return a `Drawn` too. Search each identifier and run the typecheck after:

- `@svjeez/diagrams` and `@svjeez/mermaid`: edges are parts, by `"from->to"`. `flowchart()`'s and `stateMachine()`'s edges come after the nodes (and groups) in `parts`, and a tree's edges are `"parent->child"`. Code that assumed `parts` held only nodes (`parts.length`, `parts.map` into node boxes) now sees the edges: filter with `!p.id.includes("->")`, or use the node ids you have. `Flowchart<N, G>` takes the edge ids as a third type parameter and `Tree<N>` and `StateMachine<S>` as a second, each with a default, so annotations keep compiling. A cast through `Parameters<typeof stateMachine<…>>` needs the transitions type as a second argument: `typeof stateMachine<Record<string, StateSpec>, readonly StateTransition<string>[]>`.
- `walk()` is a `Drawn` whose parts are its legs, by `"from->to"`, each spanning when the token is on it. `node`, `span` and `spans` are unchanged.
- `@svjeez/math` `derive()`: `lines` is gone. Its parts are the lines, by their TeX, each with `box` (was `lines[i].bounds`), `span` and `tex` (the aligned `tex()` that `lines[i]` was). `d.lines[i]` is `d.parts[i]!.tex`, and `d.lines.map((l) => l.bounds)` is `d.parts.map((p) => p.box)`.
- `plot(f, { animation: draw(s) })` is `plot(s, f)`: search `.plot(` with `animation`. The `animation` option is gone, since the span is how the plot knows when it plays; a plot with any other motion goes in a `<g animation={…}>`. `plot()`, `vector()`, `basis()`, `polygon()`, `line()` and `label()` on a plane return a `Drawn` (`PlaneDrawn`), not an `SvgNode`: in JSX nothing changes, but code that typed one as `SvgNode` or passed it where a node is required takes `.node`. `basis()` has the parts `"i"` and `"j"`. `PlotOptions` is `SampleOptions`.
- `construct()` is a `Drawn`: add nothing, but `g.parts`, `g.part(id)` and `g.bounds` exist. What `point()`, `segment()`, `line()`, `circle()`, `intersect()` and the bisectors return are its parts, with `id`, `box` and `span`. The plain `{ kind: "point", x, y }` type is now `ConstructSpot`; a `ConstructPoint` is a drawn point. Code that built a `ConstructPoint`, `ConstructLine` or `ConstructCircle` literal by hand to pass in takes `ConstructSpot` (points), or builds the line or circle with the builder.
- `@svjeez/geo` `traffic()`: a `Drawn` whose parts are the routes, by a line's new `id` or its index as a string. `node`, `count` and `span` are unchanged. `globe()` gains `parts`, `part(key)` and `bounds`, the regions as `project()` gives them, each with `path()` for its turning outline; it draws nothing of its own, so it has no `node` and is not a `Drawn`.

Nothing renders differently.

### Text params have a control in the editor

`@svjeez/live`'s `Value` gains `{ kind: "text", maxLength? }`, and `Settable` gains `text: string`, for a `text()` param declared in `export const params`. `@svjeez/react` and `@svjeez/svelte` draw it as `input.sj-text`; a `set` message with a string writes the new text into the file. Search `switch (value.kind)`, `value.kind ===` and `Value["kind"]` over editor values in your own controls: add a `"text"` case (an exhaustive switch or a `Record<Value["kind"], …>` is now a type error), or skip it. A list's strings stay data, edited in the source.

### `traffic()` takes a whole-number seed

`traffic({ seed })` in `@svjeez/geo` now draws from `random(seed)`, the library's one generator. Whole-number seeds give the same picture as before; a fractional seed used to be truncated silently and now throws `random() needs a whole number or a string seed`. Pass `Math.trunc(seed)`, or a string.

### Editor value keys name what holds the literal

`@svjeez/live` keys a literal that is neither a param nor inside a top-level const by what holds it, where it used to number it within its declaration. `default#0` for `<circle cx={40}>` is now `default:circle.cx`, `at` inside `enter({ at: 1.2 })` is `default:enter.0.at`, the `over` in `.to(values, span(1, 0.5))` is `default:span.1`, and a local `const r = 5` is `default:r`. A second literal held the same way gets `#1`. Only a literal nothing nameable holds (a ternary's branch, a returned number) keeps the `default#N` form, numbered among those alone. `params.*` and top-level paths such as `legs.1.over` are unchanged.

Search the project for `#` followed by a digit inside quotes next to `key`: in `editor.send({ type: "set", key: … })`, `select` messages, `state.grips[…]`, `valueOf(state, …)`, and any saved selection or test. Replace each with the key `svjeez values <scene>` now prints for that literal, or look the key up by its literal instead of writing it, as in `state.values.find((v) => v.literal.text === "40")!.key`. Keys read from `state.values` at run time need nothing.

New, nothing to migrate: `svjeez values <scene>` lists those keys with each value's kind, value, range and `file:line:column`, and `svjeez set <scene> key=value …` writes values into the file the way the editor does. Both need `@svjeez/live` installed. `editFor(value, v)` from `@svjeez/live` is the edit a `set` message makes.

### `@svjeez/dom`: keys pair page-wide, and a recording draws once what doesn't change

A `data-key` now names one element across the whole snapshot, not among its siblings. Most recordings need nothing; search for these:

- A key used by elements in different parents that are not the same thing (a `data-key="title"` in every card, say) used to pair only within each parent. It still does when the key appears more than once in a state. A key that appears once in each of two states and moves to another parent now slides there instead of fading; if that is wrong for the element, drop its `data-key` or make it unique to what it names.
- Markup arranged to keep moving elements siblings (cards placed in one CSS grid by `gridColumn` and `gridRow` so a card that changes column keeps its element) can go back to its natural structure, each element inside its own parent. Rebuild the recording and look at the frames.
- `<Dom states>` no longer draws one `<g>` per transition. What a run of transitions draws the same is written once and shown across them, and a box that only moves is one group with one motion. Code or tests that read the drawn tree (counting groups, or expecting each transition's drawing under its own `<g>`) must look for the elements themselves. The picture is the same at every time, and it never runs more animations per frame than before.
- A box whose content is replaced whole (nothing in it pairs) now hands over: the new content fades in while the old fades out, where the old used to be gone before the new came. Tests that read opacities at the middle of such a transition see both.
- `Action` has a new member, `{ pointer: { to?, at?, steps?, button? } }`, which `drag()` writes. A `switch` over `Action` keys that must be exhaustive needs a `"pointer"` case.
- A given font loaded with `{ ligatures: false }` only to make it cut down no longer needs it: a proportional face in which no ligature forms in the drawn text embeds only its drawn glyphs. Search `ligatures: false` next to fonts passed to `recordings()`, `browser()` or `<Dom fonts>` and remove it. Keep it on a monospaced coding font.

New, nothing to migrate: `drag(from, to, options?)` presses the real mouse on one target, moves onto another and lets go, with snaps between. A demo that wrote `{ act: async (page: Page) => { ...page.mouse... } }` for a drag becomes `...drag("card-42", "lane-done", { carried: snap("carried"), dropped: snap("dropped") })`, and its `import type { Page } from "playwright-core"` goes. `@svjeez/dom/react` and `@svjeez/dom/svelte` now export `act`, `drag` and the instruction types, so a demo imports them from there.
