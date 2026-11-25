# Check

`svjeez check` is the feedback loop. It reads the scene model and the SVG it emits, with no browser, and prints one report: every problem with its source and a fix, every animated lane with its backend, and the cost of the SVG.

```sh
npx svjeez check scene.tsx                   # the model and the emitted SVG, at once
npx svjeez check scene.tsx --at 0,1.5,3      # and what is on screen at those times
npx svjeez check scene.tsx --json            # for a script (same as --format json)
npx svjeez check scene.tsx --fail-on warning # exit 1 on warnings too
npx svjeez check scene.tsx --browser         # also measure the SVG in headless Chromium
npx svjeez check scene.tsx --browser --times 0,0.5 --color-scheme dark
```

```
card.tsx:44:9  low-contrast  info: <Text> "+128" is hard to see: green on raised is 3.70:1 in the light scheme (6.59:1 in dark), under the 4.5:1 text this size needs.
    fix: Pick a fill farther from raised in both schemes, or make the text larger.
0 errors, 0 warnings, 1 info; model only
cost: 24 animations, 0 repaint
lanes: 31 css, 2 smil
  smil  stdDeviation on <Shape> "glow"  paint/index.tsx:125
```

Messages name a node by its component and key (`<Shape> "dot"`, or a text's words), and a part an `<Arrow>` draws after the arrow. A node's key is the keys from the root down joined by `/`; a node with no `key` is named by its index among its siblings, so key the nodes you will read. A scene that throws while it builds is one `compile-error` problem at the line of the node or call that is wrong; until the scene builds there is nothing to describe. `check` exits 1 on any error. `--params` and `--param` work as for every command ([params.md](params.md)).

## JSON

`--json` prints exactly this (`cost` comes with the report unless a feature is unsupported; `measured` comes with `--browser`; `frames` and `timeline` with `--at`):

```ts
interface Report {
  ok: boolean;                                    // no error
  file: string;
  scene?: { size: Vec; duration: number; loop: boolean };
  problems: Problem[];                            // error, warning, info; then paint order
  lanes: LaneReport[];                            // every animated lane the backend wrote
  cost?: { animations: number; repaint: number };
  measured?: { duration: number; times: number[] };
  frames?: DescribedFrame[]; timeline?: NodeTimeline[];
}
interface Problem { code: Code; severity: "error" | "warning" | "info"; key: string; source?: { file: string; line: number; column?: number };
                    message: string; fix: string; times?: number[]; related?: { key: string; source?: Source }[] }
interface LaneReport { key: string; source?: Source; lane: string;     // "opacity", "translate", "d", "stdDeviation", …
                       backend: "css" | "smil"; spans: { start: number; over: number }[]; period?: number }
```

In code, `check(scene, { times })` from `svjeez/tools` returns `{ problems, lanes, cost? }`, `describe(scene, times)` the `--at` data, and `checkPixels(svg, options)` from `svjeez/frames` the browser pass as `{ duration, times, problems }`. `RULES` lists every code with a one-line meaning.

## Reading what is on screen

`--at` adds a timeline of each node that ever hides or changes, then every node in paint order at each time asked for, with key, kind, box (`width×height at x,y`), paint and what is changing it (`~ geometry 0.4s–3.2s`):

```
1/0/0/progress: shown 0.4s–end; trim 0.4s–3.2s, 5.4s–end
at 1.5s:
  1/0/0/progress shape ellipse 58×58 at 80,61 rotate -90° stroke blue/6 ~ trim 0.4s–3.2s
  1/0/1/2/bar shape rect 41×6 at 160,115 fill blue ~ geometry 0.4s–3.2s
```

Use it to confirm a beat before rendering frames: where a node landed, whether it is showing, what still moves.

## Codes

| Code | Severity | Reports |
| --- | --- | --- |
| `type-error` | error | TypeScript rejects the scene or a local file it imports, checked with the tsconfig.json above it (or strict defaults); skipped, with a note on stderr, when no TypeScript 5 or 6 is installed beside the scene |
| `compile-error` | error | the scene threw while it was built |
| `compile-warning` | warning | an SVG file or string the scene was given carries a warning |
| `never-visible` | warning | a node hidden at every time (opacity or scale 0), painting nothing, cut away by an empty clip, or covered by an opaque still rect drawn after it |
| `zero-size` | warning | geometry, text or an image with no size at any time |
| `off-canvas` | error, warning | outside the canvas at every time (error), or cut by its edge at rest (warning); backgrounds that bleed are left alone |
| `text-overflow` | warning | text past the canvas at rest, or a line wider than the width it wraps to |
| `overlap` | warning | two different texts over each other while both are fully shown (only the part a group's `clip` lets show counts, so complementary wipes don't warn) |
| `missing-glyph` | error | characters the text's face has no glyph for; no other font fills in |
| `low-contrast` | warning, info | text or a thin line too close to the flat color behind it, in either scheme; a moving thin line is judged by the backdrop it spends most of its time on, so a streak that only passes over something is not reported; digits a `count()` has rolled out of view are not judged; every finding carries the location of the nearest authored ancestor when the node itself was made by the library |
| `loop-seam` | warning | a looping scene jumps when it starts again: a value ends where it didn't start, a node enters and never leaves, or an arrow's ends follow a node that scales or moves in |
| `visible-at-zero` | error | shown at 0s and cut straight back in, or filled while its stroke draws in |
| `nothing-enters` | info | everything is on screen from 0s and nothing enters (not reported for a steady loop: true scene) |
| `wasted-motion` | info | a value changes before the node is first seen, or after it is gone for good |
| `static` | warning, info | nothing in the scene moves, or a value changes only after the scene ends |
| `moving-filter` | warning, info | a filter redrawn every frame; a warning when it covers a tenth of the canvas or more |
| `moving-box` | warning | a `<Group>` placed by `at` or an anchor whose content moves: `at` matches its box as it is at 0s, so the group drifts off the point. Use `offset`, or pin an outer group that holds still |
| `layout-overlap` | warning | two children of a `<Stack>` or `<Grid>` overlap: motion carried one onto another |
| `word-cut` | warning | a word wider than the width its text wraps to, cut across two lines |
| `unsupported` | error | a feature the SVG backend can't draw |
| `approximate` | warning | a feature the SVG backend draws a little differently (a blur or shadow under about 1.5) |

Fix errors first. For a warning, open a frame at the times it names; fix the scene unless the frame shows what you meant.

## Lanes and cost

A lane is one animated property of one node. `css` lanes are cheap and follow a scroll timeline; `smil` lanes (geometry, filters, gradients that change) are not. Animate `opacity`, `offset`, `scale` and `rotate` where that serves, and read `lanes: N css, M smil` after each change. `cost.animations` is the animations the browser runs at once; `cost.repaint` is the area of filters redrawn every frame, in hundreds of square units (see `moving-filter`).

## The browser pass

`--browser` needs `playwright-core` and `npx playwright-core install chromium-headless-shell`. It measures the real SVG at 0, seven times across the loop, just before the end and at the scene's keys (`--times` to choose) and adds what only pixels show: elements off the canvas, text over text, motion that changes nothing, jumps at the loop seam. It dedupes against the model's problems by code and key.

## What check can't see

Whether the picture says what you meant: a label beside the wrong bar, a beat too fast to read, colors that clash, a step off cue. Render frames and look ([render.md](render.md)).
