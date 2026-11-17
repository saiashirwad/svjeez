# Params: a scene is a template

A scene is a function of its params. It exports a schema from `svjeez/params` as `params`, and its default export takes the values and returns the SVG. The CLI, the editor and your own build each call it with values of their own: a release card renders for every release, a KPI row for every week, a leaderboard for every season. Nothing here runs in the SVG.

```tsx
import { enter, render, span, stagger } from "svjeez";
import { defaults, list, number, text, type Values } from "svjeez/params";

export const params = {
  title: text("Quarterly revenue", { maxLength: 32 }),
  bars: list(
    { label: text("Q1", { maxLength: 4 }), value: number(0, { min: 0, max: 100 }) },
    [
      { label: "Q1", value: 42 },
      { label: "Q2", value: 68 },
    ],
    { min: 1, max: 8 },
  ),
};

export default (p: Values<typeof params> = defaults(params)) => {
  const grow = stagger(span(0.4, 0.8), p.bars.length, 0.1);

  return render(
    { width: 480, height: 240, duration: 4, title: p.title },
    <>
      <text x={24} y={36} fontSize={20}>{p.title}</text>
      {p.bars.map((bar, i) => (
        <rect x={24 + i * 56} y={220 - bar.value * 1.6} width={40} height={bar.value * 1.6}
          animation={enter(grow[i]!, { opacity: 0, y: 12 })} />
      ))}
    </>,
  );
};
```

Keep the default argument `p = defaults(params)`, so the module still renders when nothing passes values. Draw for every value the schema allows: `maxLength` and a list's `max` are how the layout knows what fits. Derive time from the data with spans (`stagger(first, p.bars.length, step)`), never with fixed seconds per item.

## Calling it

- **The CLI.** `svjeez svg|frames|check|video|dev scene.tsx --params data.json` reads the JSON, checks it against the module's `params` and calls the default export with the result. `--param key=value` (repeatable) sets one value that is not a list, over the file; a number param reads the text as a number. A key the JSON or a flag leaves out keeps its default. A scene without a `params` export given either flag is an error that says so. With neither flag the CLI calls the default export with the defaults.
- **Your build.** `parse(params, json)` does what the CLI does: `build(parse(params, await readFile("data.json", "utf8")))`.
- **Text entries.** A URL's query, string form data and `--param` carry every value as text. `fromEntries(params, entries)` turns them into what `parse` reads, as the CLI does: a number param's text becomes a number when it is one, a list takes every entry with its key (`?tags=a&tags=b`), any other key its last. A list of records cannot be written as text; `parse` says so. `parse(params, fromEntries(params, new URL(request.url).searchParams))`.
- **The editor.** `@svjeez/live` reads the schema to draw a control for each value and calls the scene with them.

```sh
npx svjeez svg card.tsx --params release.json --out card.svg
npx svjeez check card.tsx --params release.json --param version=0.9.0
npx svjeez dev card.tsx --params release.json   # rebuilds when card.tsx or release.json changes
```

## Kinds

| Call | Value | Defaults |
| --- | --- | --- |
| `number(value, { min, max, step?, unit?, scale? })` | any number in `[min, max]` | `step` 0.01 |
| `count(value, { min?, max, unit?, scale? })` | a whole number | `min` 0, `step` 1 |
| `seconds(value, { min?, max, step?, unit?, scale? })` | a time | `min` 0, `step` 0.01, `unit` `s` |
| `color(value)` | a `#rgb` or `#rrggbb` hex | |
| `easing(value)` | an `Ease` from `ease` | |
| `choice(value, options)` | one of `options`, typed as their union | |
| `text(value, { maxLength? })` | a string, at most `maxLength` characters | no limit |
| `list(item, value, { min?, max? })` | an array of items | `min` 0, no `max` |

Every kind takes an optional `label` for the control. `scale: "log"` spreads a slider so small values get as much room as large ones, and needs a positive `min`. `Range` (`min`, `max`) and `Extras` (`step`, `unit`, `scale`, `label`) are the option types the number kinds take.

A list's `item` is one scalar param, as in `list(text(""), ["fast", "small"])`, or a record of them, as in `list({ name: text(""), score: count(0, { max: 999 }) }, [...])`. The item's params check every item, and a record's field values are what a field an item leaves out falls back to. A list cannot hold a list.

A bad declaration throws when the module loads: a number kind when `min` is not below `max`, a bound or the value is not finite, the step is not positive, or the value is out of range; `count` on a non-integer value or bound; `choice` on duplicate options or a value that is not one of them; `color` on a value that is not hex; `text` on a value longer than `maxLength` or a `maxLength` that is not a whole number of 1 or more; `list` on a default item its `item` rejects, a length outside `min` and `max`, or a field that is a list.

## Reading values

- `defaults(params)` returns every declared value. `Values<typeof params>` is its type: a `count` is a `number`, a `choice` the union of its options, a `text` a `string`, and a `list` a readonly array of its items, a record list's items typed field by field.
- `parse(params, json)` reads untrusted input, a JSON string or what `JSON.parse` returned, into `Values<typeof params>`. It throws on a value of the wrong type, out of range, not an option, too long, a list too short or too long, and a key the schema does not declare, naming the path: `bars[2].value needs a number from 0 to 100, got 140.`, `"colour" is not a param of this scene. It declares title, bars.` A param the input leaves out keeps its default, and so does a record item's field. An ease reads as a name from `ease` (`"pop"`) or as `{ "kind": "bezier", "points": [x1, y1, x2, y2] }`.
- `jsonSchema(params)` returns a JSON Schema for what `parse` accepts, with each param's range, options, length and default, and no required keys. Hand it to a model or a form.

A page that draws controls uses the helpers in `@svjeez/live/fit`, so the scene's bundle never carries them:

- `fit(param, v)` clamps `v` into a number param's range and rounds it to its step without float dust, as in `fit(count(5, { max: 12 }), 7.6)` returning `8`.
- `fitValues(params, patch)` fits every number in a partial set of values, so a control can pass a raw reading.
- `positionOf(param, v)` and `valueAt(param, position)` convert between a value and a slider position from 0 to 1, on the param's scale.
- `withValues(params, values)` returns the declaration with each param holding its current value, so one object carries a control's kind, range and value.

The editor draws controls for numbers, colors, eases and choices. A `text` or `list` param has no control of its own: edit its default in the source, where the numbers inside a list's records still drag.

## Handles in the picture

A scene can also say where in its own picture each number sits, so a page can put a handle there and let someone drag the value. `handles` is a function from every value to a point in scene coordinates, one per number param it covers. Put each handle on the thing its value draws.

```tsx
import { defaults, number, type Handles, type Values } from "svjeez/params";

export const params = {
  length: number(190, { min: 80, max: 240, step: 1 }),
  swing: number(30, { min: 10, max: 50, step: 1, unit: "°" }),
};

const end = (r: number, deg: number) => ({
  x: 240 + r * Math.sin((deg * Math.PI) / 180),
  y: 36 + r * Math.cos((deg * Math.PI) / 180),
});

export const handles: Handles<typeof params> = (p) => ({
  length: end(p.length, 0), // the bottom of the arc
  swing: end(p.length, -p.swing), // its far end
});
```

The scene never says which way a handle moves. `follow(param, at, v, by)` from `@svjeez/live/fit` works it out from where the handle sits at `v` and a little past it, and returns `v` moved as far as a pointer move `by` (in scene units) carries the handle that way. A handle on an arc follows the arc. The result stays in range but is not rounded, so a page keeps it through the drag and writes `fit(param, raw)`:

```ts
raw = follow(params.swing, (v) => handles({ ...values, swing: v }).swing!, raw, by);
values = { ...values, swing: fit(params.swing, raw) };
```

The declaration is plain data, so it crosses `postMessage` to a worker unchanged. A page that compiles edits off the main thread sends the values, and the worker calls the scene's default export with them.
