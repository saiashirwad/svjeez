# Upgrading svjeez from 0.5 or 0.6 to 0.7

Instructions for a coding agent. 0.7 is breaking and keeps no aliases: every old name below is gone. Do the steps in order, search with the quoted identifiers, and change only what the project uses.

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

**10. `sampled` takes `over`, not `duration`.** Search `sampled(`. The function still receives time from 0; add `at` to start later.

```ts
- sampled(fn, { duration: 4, tolerance })
+ sampled(fn, { over: 4, tolerance })
```

**11. Results carry a `span`, not `end`.** Search `.end` on the results of `typewriter`, `terminal`, `reveal`, `flow`, `morph` and the `@svjeez/charts` series (`bars`, `line`, `area` of `chart(...)`). Use `.span.end` (also `.span.at`, `.span.over`). `timeline()` keeps its own `.end`.

```ts
- const next = typewriter(...).end + 0.5;
+ const next = typewriter(...).span.end + 0.5;
```

**12. Tools take scene seconds.** `svjeez frames --times`, `restyle({ at })` and `seek(time)` used playback seconds. They now use the seconds your motions are written in. The numbers are the same unless the scene sets `render({ playbackRate })` other than 1: then multiply each old playback time by `playbackRate`. Check scrub, poster and scroll code that calls `seek` or `restyle`.

**11b. `Icon` is `IconData`** (type of `svjeez`; 0.6.1 exported `Icon` from `@svjeez/icons`). Search `\bIcon\b` imported from `@svjeez/icons`, and import `IconData` from `svjeez`. The tabler and lucide path data are unchanged. `<Icon>` the component, from `svjeez`, keeps its name.

## Escape hatches

**13. `def.property` is `css.property`.** Same arguments. `def` keeps gradients, clips, masks, markers, symbols and filters.

**14. `calc` is gone.** Search `calc.` and `calc` imported from `svjeez`. Write the CSS `calc()`, `clamp()`, `sin()` yourself inside `css`, with properties and numbers in the holes. A hole is never a string.

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
| `sampledPath(fn, options)` | `sampled.path(fn, options)` |
| `sampled.path`, `globe` with `duration` | `over` |
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
- contourSweep(f, { at, over, from, to })                 + contourSweep({ at, over }, f, { from, to })
- counter(fn, { duration: 10, step })                     + counter({ at: 0, over: 10 }, fn, { step })
- plane.vector(to, { enter: span })                       + plane.vector(span, to)
- plane.basis({ enter: span })                            + plane.basis(span)
- cartogram(map, values, { at, over })                    + cartogram({ at, over }, map, values)
- toBars(map, values, { at, over, frame })                + toBars({ at, over }, map, values, { frame })
- traffic(lines, { during: span, rate })                  + traffic(span, lines, { rate })
- trueSize(map, region, to, { at, over, duration })       + trueSize({ at, over }, map, region, to)
- choropleth(map, values, { scale, at: [0, 3] })          + choropleth(map, values, { scale, times: [0, 3] })
- { lane: "a", from: 1, to: 4 }                           + { lane: "a", at: 1, over: 3 }   // LaneSpan is LaneBar
```

  Details. A bar series now ends with its span: each bar grows for `over - (bars - 1) * stagger`, `stagger` defaults to 0.08 or less when the span is short, `ease` is an option, and `bars` also takes `[key, value]` pairs. `derive`'s `every` is gone: the changes are spaced evenly across the span and `over` became `change`. `counter(fn)` reads `fn` from 0 at the span's start, not at scene time 0. `cartogram` and `toBars` with `stagger` start the shapes that far apart and land the last with the span. `trueSize` takes a core `Ease` and defaults to `ease.inOut`, a slightly different curve from the old cubic. `Timing` is gone from `@svjeez/math` and `@svjeez/charts`.
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
- `google.family(family, ...faces)` takes faces as `{ weight, style }` objects, like `font.family(...faces)` takes fonts. A face takes the options of `google()`, and the first face's `fallback` is the family's. `GoogleFace` is gone.

```ts
- google.family("Geist", [400, { weight: 600, style: "italic" }], { ligatures: false })
+ google.family("Geist", { weight: 400, ligatures: false }, { weight: 600, style: "italic", ligatures: false })
```

- `.to(values, span, ease?)` is gone: `.to` takes a length. Search `.to(` with a span as the second argument and write `.at(span.at).to(values, span.over, ease)`.
- `defaultLight` is gone (use `systemLight`), and `inkPath` is no longer exported from `svjeez`.
- `@svjeez/code`: the palettes (`tomorrow`, `solarizedDark` and the rest) come from `@svjeez/code/palettes` only, and the root no longer re-exports `CodePiece`, `CodeRole` or `CodeTokens`: import those types from `svjeez`. Importing the package no longer loads Shiki until `highlight()` runs.
- `@svjeez/icons`: the package root is gone, so `import type { IconData } from "@svjeez/icons"` is `import type { IconData } from "svjeez"`. The `/tabler` and `/lucide` paths stay. `svjeez` is now a peer dependency, for that type.
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
