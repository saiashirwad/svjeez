# Upgrading to 0.7

0.7 is a breaking release and keeps no aliases: every old name is gone. It moves things out of core, renames some, and gives time one model. Run [`scripts/codemod-0.7.ts`](scripts/codemod-0.7.ts) first, then fix the rows marked **by hand** and whatever it warns about. The tables describe upgrading from 0.5 or 0.6.

```sh
bun codemod-0.7.ts --dry src   # list the files it would change
bun codemod-0.7.ts src         # rewrite them, then run your formatter
```

It needs nothing installed (download the file, commit your work, run it from the project) and rewrites `.ts`, `.tsx`, `.js` and `.jsx` files.

## Imports and packages

`svjeez/extras` is gone: everything that stayed is in `svjeez`.

| Before | Now | |
| --- | --- | --- |
| `svjeez/extras` | `svjeez` | codemod |
| `flowchart`, `sequence`, `lanes`, `tree`, `stateMachine` and their types | `@svjeez/diagrams` | codemod |
| `axes`, calculus (`Area`, `Curve`, `Dot`, `Line`) and the fields (`contours`, `slopeField`, `streamlines`, ...) | `@svjeez/math` | codemod |
| `tomorrow`, `solarizedDark`, `gruvboxLight` and the other editor palettes | `@svjeez/code` | codemod |
| `fit`, `positionOf`, `valueAt`, `fitValues`, `withValues`, `follow` from `svjeez/params` | `@svjeez/live` | codemod |
| `svjeez/voxel`, `voxel` | Removed, no replacement | the codemod warns |
| `restyle` from `svjeez` | `svjeez/page` | by hand |
| `validateSvg` from `svjeez` | `svjeez/frames` | by hand |

`svjeez/params` keeps the scene-facing half. `@svjeez/diagrams` is a new package, and `@svjeez/mermaid` builds on it.

## Renames

| Before | Now | |
| --- | --- | --- |
| `Values` | `ChannelValues` | codemod |
| `sample`, `SampleOptions` | `valuesAt`, `ValuesAtOptions` | codemod |
| `<Pivot at>` | `<Pivot origin>` | codemod |
| `flow(points, { loop })` | `flow(points, { period })` | codemod |
| `fieldFlow(lines, options)` | `flow(lines, options).node`, which takes a list of lines | codemod |
| `sampledPath(fn, options)` | `sampled.path(fn, options)` | codemod |
| `<Steady at>` | `<Camera steady origin>` | codemod |
| `renderVideo` | `video` | codemod |
| `Icon` type of `@svjeez/icons` | `IconData` | codemod |
| `fx.blur(6)` | `fx.blur({ by: 6 })` | by hand |

## Time

Time has one model: a span says when, `<Clip>` gives children a local clock, and `show` turns a span into visibility. New in 0.7 and needing no migration: `<Clip at over>` (children write time from 0, nested clips add up), `.repeat(n)` and `.repeat({ until })` for loops that stop, `.rewind(over)` to glide back to the start at the end of the clip, and `span.next(over, gap)` and `span.pad(before, after)`. `.loop(period)` is unchanged.

| Before | Now | |
| --- | --- | --- |
| `during(span, fade)` | `show(span, { fade })` | codemod |
| `cut(span)` | `show(span, { fade: 0 })` | codemod |
| `visible(spans, fade)` | `show(spans, { fade })`. `show` fades inside the span, where `visible` faded outside it | codemod, warns |
| `tl.show(name)`, `tl.enter(name)` | `show(tl.name)`, `show({ at: tl.name.at })` | codemod |
| `sampled(fn, { duration })`, `sampled.path`, `nightfall` and `globe` with `duration` | `{ over }`, plus `at` to start later. The function is given time from 0 | codemod |
| `.end` of a `typewriter`, `terminal`, `reveal`, `flow` or `morph` result | `.span.end` | codemod |
| `.end` of a `derive`, `epicycles`, `traffic`, `walk`, chart or construction result | `.span.end` | by hand |
| `during` on `Arrow`, `Brace`, `Callout`, `Underline`, and on `Focus`, `Marker` and `Camera` stops | `show` | by hand |
| `frames --times`, `restyle({ at, onceAt })` and `seek` in playback seconds | Scene seconds: the same numbers unless `playbackRate` is not 1 | by hand |

## Escape hatches

| Before | Now | |
| --- | --- | --- |
| `def.property(...)` | `css.property(...)` | by hand |
| `calc` | Plain `calc()` inside `css`, with property holes: css`translate: calc(${px} * 1px) 0` | by hand |
| `el.rect(props, content)` | JSX, `<rect {...props}>{content}</rect>` | by hand |
| `render({ css })` for one global rule | Still works. `<Style css={...} />` puts the rule inside the scene | optional |

## One plane

`axes()` and the 0.6 `plane()` are one coordinate system now, `plane()` from `@svjeez/math`, taking ranges and a size.

| Before | Now | |
| --- | --- | --- |
| `axes(options)`, `Axes`, `AxesOptions` | `plane(options)`, `Plane`, `PlaneOptions`. The options, `point()`, `plot()` and the calculus methods are the same | codemod |
| `{ axes }` of `contours` and `contourSweep` | `{ plane }` | codemod |
| `plane({ origin, unit, extent, step })` | `plane({ x, y, width, height, at, ticks })`: `x` and `y` are the ranges `extent` was, `width` is `(x[1] - x[0]) * unit`, `at` is `{ x: origin.x + x[0] * unit, y: origin.y - y[1] * unit }`, `ticks` is `step` | by hand, the codemod warns |

## Theme variables are scoped

`variables(dark, light)` took no scope and styled every `svg` on the page, so two inline scenes clashed. Give it the `prefix` you give `render`: `variables(dark, light, { prefix })` scopes the variables to that scene's root. Without `prefix` it behaves as before. New, no migration needed.
