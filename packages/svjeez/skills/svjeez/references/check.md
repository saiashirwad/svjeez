# Check and describe

`svjeez check` is the feedback loop. It reads the scene model, with no browser, and reports what a number can find: each finding names the line that wrote the node, the node's key, what is wrong in the scene's terms (seconds, units, colors by token name), and what to change.

```sh
npx svjeez check scene.tsx --no-browser             # the model only, at once
npx svjeez check scene.tsx --no-browser --at 0,1.5,3 # and what is on screen at those times
npx svjeez check scene.tsx --no-browser --json       # for a script
npx svjeez check scene.tsx                           # the model, then the SVG measured in headless Chromium
```

```
card.tsx:44:9  low-contrast  info: <Text> "+128" is hard to see: green on raised is 3.70:1 in the light scheme (6.59:1 in dark), under the 4.5:1 text this size needs.
    hint: Pick a fill farther from raised in both schemes, or make the text larger.
0 errors, 0 warnings, 1 info; model only
```

A node’s key is its path from the root, with each name joined by `/`. A component’s JSX key names the node it returns. If it returns a fragment, the key prefixes each child’s path. A node with no `key` or `ref` gets a numeric name among its siblings.

Messages name a node by its component and its key, as `<Shape> "dot"`, or by its words for a text with no key, and a part an `<Arrow>` draws is named after the arrow. Key the nodes you will want to read. A scene that throws while it builds is one `compile-error` finding: its `source` is the line of the node or the call that is wrong, its message says what is wrong and its hint what to change. Until the scene builds, `--at` has nothing to describe. `check` exits 1 on any error. `--params` and `--param` work as for every command ([params.md](params.md)); `--color-scheme` picks the scheme the browser pass measures.

## Reading what is on screen

`--at` adds a description of the scene: first a timeline of each node that ever hides or changes, then each time asked for, every node in paint order with its key, kind, box (`width×height at x,y` in scene units), paint and what is changing it (`~ at 1.4s–2s`). Repeated siblings fold into one line.

```
timeline:
  1/0/0/progress: shown throughout; trim 0.4s–3.2s, 5.4s–end
  1/0/1/1/done: shown 3.2s–5.5s; opacity 3.2s–3.5s, 5.2s–5.5s
at 4s:
  1/0/0/ring shape ellipse 58×58 at 80,61 stroke raised/6
  1/0/0/2/check shape path 24×18 at 97,81 stroke green/4 ~ scale 3.2s–4.365s
  1/0/1/1/done text 53×16 at 160,89 fill green "Uploaded"
```

Use it to confirm a beat before rendering frames: where a node landed, whether it is showing, what is still moving. "Shown" reads opacity and scale; a stroke trimmed to nothing still counts as shown.

## JSON

`--json` prints `{ errors, warnings, info }`, and with `--at` also `frames` and `timeline`. A finding is `{ code, severity, key, source: { file, line, column }, message, hint, times?, related? }`; `key` is empty when the scene didn't build, `times` lists the seconds it was seen at, `related` names other nodes involved. A frame is `{ t, nodes }`, each node `{ key, kind, depth, box: [x, y, width, height], geometry?, text?, fill?, stroke?, rotate?, opacity?, changing?: [{ value, from, to }] }`.

In code, `inspect(scene)` and `describe(scene, times)` from `svjeez/tools` return the same, and `RULES` lists every code.

## Rules

| Code | Severity | Reports |
| --- | --- | --- |
| `compile-error` | error | the scene threw while it was built; only `svjeez check` reports it |
| `never-visible` | warning | a node hidden at every time (opacity or scale 0), painting nothing, cut away by an empty clip, or covered at every time by an opaque, still rect drawn after it |
| `zero-size` | warning | geometry, text or an image with no size at any time |
| `off-canvas` | error, warning | outside the canvas at every time (error), or cut by its edge at rest (warning); backgrounds that bleed are left alone |
| `text-overflow` | warning | text past the canvas at rest, or a line wider than the width it wraps to |
| `overlap` | warning | two different texts over each other while both are fully shown |
| `missing-glyph` | error | characters the text's face has no glyph for; no other font fills in |
| `low-contrast` | warning, info | text or a thin line too close to the flat color behind it, in either scheme |
| `loop-seam` | warning | a looping scene jumps when it starts again: a value ends where it didn't start, by how far; or a node enters and never leaves, so it vanishes at the seam; or an arrow's ends follow a node that scales or moves in |
| `visible-at-zero` | error | shown at 0s and cut straight back in, or filled while its stroke draws in |
| `nothing-enters` | info | everything is on screen from 0s and nothing enters |
| `wasted-motion` | info | a value changes before the node is first seen, or after it is gone for good |
| `static` | warning, info | nothing in the scene moves, or a value changes only after the scene ends |
| `unused-symbol` | info | a symbol no instance draws |
| `layout-overlap` | warning | two children of a `<Stack>` or `<Grid>` overlap: motion carried one onto another |
| `word-cut` | warning | a word wider than the width its text wraps to, cut across two lines |
| `unattached-ref` | warning | a ref the scene made that no node takes |
| `hidden-target` | warning | a timeline moves a node that is never visible |
| `unsupported` | error | a feature the SVG backend can't draw |
| `approximate` | warning | a feature the SVG backend draws a little differently (a blur or shadow that goes below about 1.5) |
| `compile-warning` | warning | a warning from writing an SVG string; only `svjeez check` |

Fix errors first. For a warning, look at a frame at the times it names; fix the scene unless the frame shows what you meant. The browser pass adds what only pixels show, measured at 0, seven times across the loop, just before the end and at the scene's keys (`--times` to choose): elements off the canvas, text over text, motion that changes nothing, and jumps at the loop seam. It needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.

## What check can't see

Whether the picture says what you meant: a label beside the wrong bar, a beat too fast to read, colors that clash, a step that happens off cue. Render frames and look ([render.md](render.md)).
