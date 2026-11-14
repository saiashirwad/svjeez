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

**2. Diagrams moved to `@svjeez/diagrams`.** Search `flowchart`, `sequence`, `lanes`, `tree`, `stateMachine` and their types (`Flowchart`, `FlowchartOptions`, `FlowchartEdge`, `FlowchartGroup`, `Sequence*`, `Lanes*`, `Lane*`, `Tree`, `TreeOptions`, `TreeSpec`, `State*`, `StateMachine`, `Checked`, `Transition`, `Walk`, `WalkToken`, `Diagram`, `DiagramOptions`, `Anchor`, `Labelled`, `NodeRole`). Import them from `@svjeez/diagrams`. Behavior is unchanged.

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

**11. Results carry a `span`, not `end`.** Search `.end` on the results of `typewriter`, `terminal`, `reveal`, `flow`, `morph` and the `@svjeez/charts` series (`bars`, `line`, `area` of `chart(...)`). Use `.span.end` (also `.span.at`, `.span.over`). `timeline()` keeps its own `.end` and `.duration`.

```ts
- const next = typewriter(...).end + 0.5;
+ const next = typewriter(...).span.end + 0.5;
```

**12. Tools take scene seconds.** `svjeez frames --times`, `restyle({ at })` and `seek(time)` used playback seconds. They now use the seconds your motions are written in. The numbers are the same unless the scene sets `render({ playbackRate })` other than 1: then multiply each old playback time by `playbackRate`. Check scrub, poster and scroll code that calls `seek` or `restyle`.

**11b. `Icon` is `IconData`** (type of `@svjeez/icons`, 0.6.1 exported `Icon`). Search `\bIcon\b` imported from `@svjeez/icons`. The tabler and lucide path data are unchanged. `<Icon>` the component, from `svjeez`, keeps its name.

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

**16.** `variables(dark, light)` and `adaptive` styled every `svg` on the page. If the project inlines two scenes that use them, pass the `prefix` given to `render`: `variables(dark, light, { prefix })`, `adaptive({ dark, light, prefix })`. Without `prefix` nothing changes.

## Removed, no replacement

**17. Voxels.** Search `voxel` imported from `svjeez` (0.5), `svjeez/voxel` (0.6) or `@svjeez/voxel`. There is no replacement. Ask the user whether to keep a pre-rendered SVG of the scene, redraw it with plain shapes, or drop it. Do not guess.

## Only if the project ran an unpublished build of main

These were never on npm: 0.5.0 and 0.6.1 of `svjeez` and 0.6.1 of the `@svjeez/*` packages do not export them, and `@svjeez/math` 0.6.1 had only `tex`, `Tex`, `Glyph` and `Matrix`. Skip this section unless the code came from a git checkout of main and imports `@svjeez/math` beyond `tex`, `@svjeez/video`, `svjeez/params` or `svjeez/internal`.

| Search | Now |
| --- | --- |
| `axes(`, `Axes`, `AxesOptions`, `{ axes }` of `contours`, `contourSweep` | `plane`, `Plane`, `PlaneOptions`, `{ plane }` |
| `plane({ origin, unit, extent, step })` | `plane({ x, y, width, height, at, ticks })`, see below |
| `Area`, `Curve`, `Dot`, `Line` (calculus), `MorphCurveOptions` | `CalculusArea`, `CalculusCurve`, `CalculusDot`, `CalculusLine`, `CalculusMorphOptions` |
| `sample`, `SampleOptions` | `valuesAt`, `ValuesAtOptions` |
| `<Pivot at>` | `<Pivot origin>` |
| `<Steady at>` | `<Camera steady origin>` |
| `flow(points, { loop })` | `flow(points, { period })` |
| `fieldFlow(lines, options)` | `flow(lines, options).node` |
| `sampledPath(fn, options)` | `sampled.path(fn, options)` |
| `sampled.path`, `globe`, `nightfall` with `duration` | `over` |
| `.end` of `derive`, `epicycles`, `traffic`, `walk`, constructions | `.span.end` |
| `renderVideo` (`@svjeez/video`) | `video` |
| voxel block `at`, `from`, `to` | gone with voxels (step 17) |
| `fit`, `positionOf`, `valueAt`, `fitValues`, `withValues`, `follow` from `svjeez/params` | `@svjeez/live` |
| `el` from `svjeez/internal` | JSX (step 15) |

`axes` and `plane` are one coordinate system now, in `@svjeez/math`. For the old `plane({ origin, unit, extent, step })`, with `extent` as `{ x: [x0, x1], y: [y0, y1] }`:

```ts
- plane({ origin: { x: ox, y: oy }, unit: u, extent: { x: [x0, x1], y: [y0, y1] }, step: s })
+ plane({
+   x: [x0, x1],
+   y: [y0, y1],
+   width: (x1 - x0) * u,
+   height: (y1 - y0) * u,
+   at: { x: ox + x0 * u, y: oy - y1 * u }, // top-left of the plot area
+   ticks: s,
+ })
```

`unit` was one scale for both axes, so `height` uses it too. Check that `at` lands the graph origin on `origin`: `point(0, 0)` of the new plane should equal the old `origin`.
