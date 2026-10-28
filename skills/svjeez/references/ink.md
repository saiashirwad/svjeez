# Ink

`<Ink>` draws a path with a hand tool instead of an even SVG stroke. The tool sets the width at every point, and the stroke becomes a filled outline.

```tsx
import { Ink, inkPath, tool } from "svjeez";

const wave = "M20 80C80 20 160 140 220 80";
const brushed = <Ink d={wave} tool={tool.brush({ size: 8, seed: 2 })} fill="#2B2118" draw={{ at: 0.5, over: 1.2 }} />;
const coast = <Ink d="M10 10L90 40" tool={tool.nib({ size: 3, angle: 40 })} fill="#2B2118" />;
const outline = inkPath(wave, tool.pen({ size: 1.2 })); // the outline as path data, to fill yourself
```

## Tools

| Tool | Looks like |
| --- | --- |
| `tool.pen({ size, taper, seed })` | An even line with slightly thinned ends |
| `tool.brush({ size, taper, pressure, wobble, seed })` | Swells mid-stroke and lifts to a point |
| `tool.nib({ size, angle, thin })` | A broad calligraphy nib: thick across its edge, thin along it |
| `tool.pencil({ size, seed })` | A fine line that wavers with the grain |

A `seed` rerolls the wobble, and the same seed draws the same line. A tool is a plain `{ width(t, s, angle), drift?, size }` object, so you can write your own.

## Props

- `d` is any SVG path data, arcs included. It is the centerline of the mark.
- `fill` is the ink. The outline is filled, so gradients work and `stroke` does not.
- `draw={{ at, over }}` inks the stroke in along its path through a mask, then swaps to an unmasked copy so it costs nothing once drawn. `ease` shapes the reveal and defaults to `ease.inOut`.
- `animation` moves, scales, rotates or fades the whole mark.
- Each path and tool pair embeds its outline once, so reusing a tool object is cheap.

## Handwriting

`strokeFont` reads a single-line SVG font (Hershey and EMS fonts such as EMS Allure). `path(text, { size, x, y }).d` gives the centerlines to ink. One `d` with several subpaths reveals them all at once. To write stroke by stroke, split at each `M` and give every piece its own `draw` span, paced by its length.

```tsx
import { Ink, ease, strokeFont, tool } from "svjeez";

const hand = await strokeFont.load(new URL("./EMSAllure.svg", import.meta.url));
const SPEED = 1500; // px of pen travel per second

/** Rough pen travel: the length of the control polygon. */
const lengthOf = (d: string): number => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;
  for (let i = 2; i + 1 < xy.length; i += 2) sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);
  return sum;
};

const x = (800 - hand.measure("Write anything.", 100)) / 2;
const strokes = hand
  .path("Write anything.", { size: 100, x, y: 200 })
  .d.split(/(?=M)/)
  .reduce<{ d: string; at: number; over: number }[]>((out, d) => {
    const at = out.length ? out.at(-1)!.at + out.at(-1)!.over + 0.04 : 0.5; // a breath between lifts
    return [...out, { d, at, over: lengthOf(d) / SPEED }];
  }, []);

const written = strokes.map(({ d, at, over }) => <Ink d={d} tool={tool.nib({ size: 6, angle: 35, thin: 0.25 })} fill="#2B2118" draw={{ at, over }} ease={ease.linear} />);
```

`ease.linear` keeps the pen at one speed. Hand tools suit a hand-drawn map or sketch: a nib for coasts, a fine pen for hatching, a brush for rivers. Keep a shared `tool` object per look.
