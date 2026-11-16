# Fields and level sets

Vector fields, streamlines, slope fields and contour lines, all from `@svjeez/math` (`npm i -D @svjeez/math`). They work in scene px, or in graph units through a `plane()`. Each returns path data or point lists, so you draw the result with `<path>`, `flow()` and the recipes you already know.

```tsx
import { contours, fieldLines, streamlines, vectorField } from "@svjeez/math";
```

## Streamlines

`field(x, y)` takes scene px and returns `[u, v]`, with y growing down the page. Only the direction matters.

```tsx
const wind = (x, y) => [1, 0.4 * Math.sin(x / 90)];
const { lines, d } = streamlines(wind, { frame: rect(24, 24, 600, 490), spacing: 22 });
```

Lines keep `spacing` px between neighbours. They start at the middle of `frame` and fill outward, so `lines[0]` is nearest the middle. Each line is a list of points that runs with the field, ready for `flow(line, …)`. `d` is every line as one path.

| Option | Meaning |
| --- | --- |
| `frame` | The region to fill, a `Rect`. `plane().bounds` fits. |
| `spacing` | Gap between lines in px. Default 24. |
| `seeds` | Trace from exactly these points and fill nothing else. |
| `step` | Integration step in px. Default 2. |
| `maxLength` | Longest line in px. Default 900. Raise it for fields that wind. |
| `minLength` | Shorter lines are dropped. Default the spacing. |
| `tolerance` | How far simplifying may move a point, in px. Default 0.25. |

A line ends at the frame, at a stagnation point, beside another line, or at `maxLength`.

`fieldLines(span, lines, options?)` draws the lines on one after another over `span`, nearest the middle first. `each` sets how long one line takes, and `color`, `strokeWidth` and `opacity` style them. `flow(lines, { at })` from `svjeez` takes the whole list and runs one particle along every line, again and again:

```tsx
{fieldLines({ at: 1, over: 3 }, lines, { color: blue })}
{flow(lines, { at: 3, speed: 110, color: orange }).node}
```

Every line has its own length and so its own period, and each particle starts a different way along its line, so the field never pulses. `style: "comet"` gives each particle a short tail. `rest` is the pause between trips. Mind the size. A `dot` costs one or two animated elements per line and the keyframes of its path, around 1 KB. `examples/fields/index.tsx` has about 55 lines, and with its two plots the scene is 212 KB. Use a larger `spacing` or `tolerance` to shrink it, and prefer `dot` over `comet` for more than about 30 lines.

## Arrows

`vectorField(field, { frame, spacing })` returns `{ d, arrows }`: one path with every arrow, and the arrows as `{ from, to, magnitude }` for coloring or revealing them yourself. Arrows are centered on a lattice. The longest fits 0.85 of `spacing` unless you set `scale` (px per unit of field). `normalize: true` gives every arrow one length. Stroke the path with round caps and no fill.

## Slope fields

`slopeField(f, plane)` draws short marks along dy/dx = `f(x, y)`, in graph units over the plot's range. `step` is the spacing along x in graph units, `stepY` along y (default `step`), and `length` is a mark's length in px. A `NaN` slope draws nothing, and an infinite one draws a vertical mark. `slopeSolution(f, plane, { x, y })` integrates the curve through a point, both ways, and returns `{ points, d }`. Draw it on with `draw()`.

```tsx
const f = (x, y) => x - y;
const field = slopeField(f, plot, { step: 0.5, length: 12 });
const curve = slopeSolution(f, plot, { x: -3, y: 2 });
```

## Contours

`contours(source, { levels, frame | plane })` runs marching squares and returns one `{ level, lines, d }` per level. `lines` are `{ points, closed }`, with segments joined into polylines. `d` is the level as one path, closed rings ending in `Z`. A line that leaves the frame ends there.

`source` is a function of `(x, y)`, called in graph units when you pass `plane` and in scene px when you pass `frame`, or a precomputed `Grid`:

```tsx
// An implicit curve: x² + y² = 1 is the level 0 of x² + y² − 1.
const [circle] = contours((x, y) => x * x + y * y - 1, { plane: plot, levels: [0] });

// Elevation lines from your own samples. Row 0 is the top of the frame.
const rings = contours({ cols: 90, rows: 60, values: elevations }, { frame, levels: [100, 200, 300] });
```

`resolution` is px between samples of a function. Default 4. A finer grid costs time but not file size, because `tolerance` (default 0.2 px) thins the points. A NaN sample leaves its cells empty, so `Math.sqrt` of a negative cuts the curve there. Fill a level with `fillRule="evenodd"` when it holds rings inside rings.

### A level that moves

`contourSweep(span, source, { plane | frame, from, to })` returns `{ d, animation }`. Give `d` to a `<path>` and `animation` to its `animation`. It morphs one level line as the level rises, through `matchPaths()`. It reads well while lines grow, shrink and bend, as a circle widens or a heart grows from a point at its center. Each frame is a full outline, so `frames` (default 16) sets both how closely the curve is followed and the size.

```tsx
const sweep = contourSweep({ at: 2, over: 2.6 }, heart, { plane: plot, from: -0.97, to: 0 });
<path d={sweep.d} animation={sweep.animation} />;
```

Where loops split or merge, rings pair by order and one grows from a point, which looks like a bud rather than a split. For terrain, draw one `contours()` level per step instead and bring each in with `draw()` or `enter()`, a beat apart. Every level you sweep must cross the frame.

## Errors

| Error | Fix |
| --- | --- |
| `streamlines() needs a positive …, got ….` | Pass a number above 0 for `spacing`, `step` or `maxLength`. |
| `… needs a frame with a positive w and h, got … by ….` | Pass a `Rect`, such as `plane().bounds`. |
| `contours() needs a frame or plane to place the samples.` | Pass one of them. |
| `contours() needs a grid of at least 2 by 2 with cols * rows values, got ….` | Make `values` as long as `cols * rows`. |
| `contourSweep() found no line at level ….` | Sweep only levels the frame crosses, or widen the frame. |
| `flow() needs a period past …s to hold the trip and the comet's tail, got …s.` | Raise `period`. |
