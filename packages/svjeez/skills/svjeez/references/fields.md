# Fields and level sets

Vector fields, streamlines, slope fields and contour lines, all from `svjeez/extras`. They work in scene px, or in graph units through an `axes()` plot. Each returns path data or point lists, so you draw the result with `<path>`, `flow()` and the recipes you already know.

```tsx
import { contours, fieldFlow, fieldLines, streamlines, vectorField } from "svjeez/extras";
```

## Streamlines

`field(x, y)` takes scene px and returns `[u, v]`, with y growing down the page. Only the direction matters.

```tsx
const wind = (x, y) => [1, 0.4 * Math.sin(x / 90)];
const { lines, d } = streamlines(wind, { bounds: { x: 24, y: 24, w: 600, h: 490 }, spacing: 22 });
```

Lines keep `spacing` px between neighbours. They start at the middle of `bounds` and fill outward, so `lines[0]` is nearest the middle. Each line is a list of points that runs with the field, ready for `flow(line, …)`. `d` is every line as one path.

| Option | Meaning |
| --- | --- |
| `bounds` | The region to fill. `axes().bounds` fits. |
| `spacing` | Gap between lines in px. Default 24. |
| `seeds` | Trace from exactly these points and fill nothing else. |
| `step` | Integration step in px. Default 2. |
| `maxLength` | Longest line in px. Default 900. Raise it for fields that wind. |
| `minLength` | Shorter lines are dropped. Default the spacing. |
| `tolerance` | How far simplifying may move a point, in px. Default 0.25. |

A line ends at the bounds, at a stagnation point, beside another line, or at `maxLength`.

`fieldLines(lines, { at, over })` draws the lines on one after another, nearest the middle first. `each` sets how long one line takes, and `color`, `strokeWidth` and `opacity` style them. `fieldFlow(lines, { at })` runs one particle along every line, again and again:

```tsx
{fieldLines(lines, { at: 1, over: 3, color: blue })}
{fieldFlow(lines, { at: 3, speed: 110, color: orange })}
```

Every line has its own length and so its own period, and each particle starts a different way along its line, so the field never pulses. `style: "comet"` gives each particle a short tail. `rest` is the pause between trips. Mind the size. A `dot` costs one or two animated elements per line and the keyframes of its path, around 1 KB. `examples/fields/index.tsx` has about 55 lines, and with its two plots the scene is 212 KB. Use a larger `spacing` or `tolerance` to shrink it, and prefer `dot` over `comet` for more than about 30 lines.

## Arrows

`vectorField(field, { bounds, spacing })` returns `{ d, arrows }`: one path with every arrow, and the arrows as `{ from, to, magnitude }` for coloring or revealing them yourself. Arrows are centered on a lattice. The longest fits 0.85 of `spacing` unless you set `scale` (px per unit of field). `normalize: true` gives every arrow one length. Stroke the path with round caps and no fill.

## Slope fields

`slopeField(f, axes)` draws short marks along dy/dx = `f(x, y)`, in graph units over the plot's range. `step` is the spacing along x in graph units, `stepY` along y (default `step`), and `length` is a mark's length in px. A `NaN` slope draws nothing, and an infinite one draws a vertical mark. `slopeSolution(f, axes, { x, y })` integrates the curve through a point, both ways, and returns `{ points, d }`. Draw it on with `draw()`.

```tsx
const f = (x, y) => x - y;
const field = slopeField(f, plot, { step: 0.5, length: 12 });
const curve = slopeSolution(f, plot, { x: -3, y: 2 });
```

## Contours

`contours(source, { levels, bounds | axes })` runs marching squares and returns one `{ level, lines, d }` per level. `lines` are `{ points, closed }`, with segments joined into polylines. `d` is the level as one path, closed rings ending in `Z`. A line that leaves the bounds ends there.

`source` is a function of `(x, y)`, called in graph units when you pass `axes` and in scene px when you pass `bounds`, or a precomputed `Grid`:

```tsx
// An implicit curve: x² + y² = 1 is the level 0 of x² + y² − 1.
const [circle] = contours((x, y) => x * x + y * y - 1, { axes: plot, levels: [0] });

// Elevation lines from your own samples. Row 0 is the top of the bounds.
const rings = contours({ cols: 90, rows: 60, values: elevations }, { bounds, levels: [100, 200, 300] });
```

`resolution` is px between samples of a function. Default 4. A finer grid costs time but not file size, because `tolerance` (default 0.2 px) thins the points. A NaN sample leaves its cells empty, so `Math.sqrt` of a negative cuts the curve there. Fill a level with `fillRule="evenodd"` when it holds rings inside rings.

### A level that moves

`contourSweep(source, { axes | bounds, from, to, at, over })` returns `{ d, animation }`. Give `d` to a `<path>` and `animation` to its `animation`. It morphs one level line as the level rises, through `matchPaths()`. It reads well while lines grow, shrink and bend, as a circle widens or a heart grows from a point at its center. Each frame is a full outline, so `frames` (default 16) sets both how closely the curve is followed and the size.

```tsx
const sweep = contourSweep(heart, { axes: plot, from: -0.97, to: 0, at: 2, over: 2.6 });
<path d={sweep.d} animation={sweep.animation} />;
```

Where loops split or merge, rings pair by order and one grows from a point, which looks like a bud rather than a split. For terrain, draw one `contours()` level per step instead and bring each in with `draw()` or `enter()`, a beat apart. Every level you sweep must cross the bounds.

## Errors

| Error | Fix |
| --- | --- |
| `streamlines() needs a positive …, got ….` | Pass a number above 0 for `spacing`, `step` or `maxLength`. |
| `… needs bounds with a positive w and h, got … by ….` | Pass `{ x, y, w, h }`, such as `axes().bounds`. |
| `contours() needs bounds or axes to place the samples.` | Pass one of them. |
| `contours() needs a grid of at least 2 by 2 with cols * rows values, got ….` | Make `values` as long as `cols * rows`. |
| `contourSweep() found no line at level ….` | Sweep only levels the bounds cross, or widen the bounds. |
| `flow() needs a loop period past …s to hold the trip and the comet's tail, got …s.` | Raise `loop`. |
