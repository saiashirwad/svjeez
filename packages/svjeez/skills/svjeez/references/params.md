# Editable params with svjeez/params

`svjeez/params` declares the values a scene lets someone change: a count, a length, a time, a color, an ease, or one of a few names. The scene exports the declaration as `params` and stays a pure function of the values. A page, an editor or a worker reads the same plain object to draw a control for each value and to keep every value in range. Nothing here runs in the SVG.

```tsx
import { ease, motion, render } from "svjeez";
import { choice, color, count, defaults, easing, number, seconds, type Values } from "svjeez/params";

export const params = {
  dots: count(5, { min: 1, max: 12, label: "how many" }),
  gap: number(40, { min: 16, max: 80, step: 1, unit: "px" }),
  stagger: seconds(0.15, { max: 0.5 }),
  fill: color("#FF5D8F"),
  rise: easing(ease.pop),
  shape: choice("circle", ["circle", "square"]),
};

export default (p: Values<typeof params> = defaults(params)) =>
  render(
    { width: 480, height: 120, duration: 3, title: "Dots" },
    <>
      {Array.from({ length: p.dots }, (_, i) => {
        const rise = motion({ y: 60, opacity: 0 }).at(i * p.stagger).to({ y: 0, opacity: 1 }, 0.5, p.rise);
        const x = 240 + (i - (p.dots - 1) / 2) * p.gap;

        return p.shape === "circle" ? (
          <circle cx={x} cy={60} r={12} fill={p.fill} animation={rise} />
        ) : (
          <rect x={x - 12} y={48} width={24} height={24} fill={p.fill} animation={rise} />
        );
      })}
    </>,
  );
```

## Kinds

| Call | Value | Defaults |
| --- | --- | --- |
| `number(value, { min, max, step?, unit?, scale? })` | any number in `[min, max]` | `step` 0.01 |
| `count(value, { min?, max })` | a whole number | `min` 0, `step` 1 |
| `seconds(value, { min?, max, step? })` | a time | `min` 0, `step` 0.01, `unit` `s` |
| `color(value)` | a `#rrggbb` hex | |
| `easing(value)` | an `Ease` from `ease` | |
| `choice(value, options)` | one of `options`, typed as their union | |

Every kind takes an optional `label` for the control. `scale: "log"` spreads a slider so small values get as much room as large ones, and needs a positive `min`. A number kind throws when `min` is not below `max`, the step is not positive, or the value is out of range, so a bad declaration fails when the module loads.

## Reading values

- `defaults(params)` returns every declared value, typed per key: a `count` is a `number`, a `choice` is the union of its options. `Values<typeof params>` is that type.
- `fit(param, v)` clamps `v` into a number param's range and rounds it to its step without float dust, as in `fit(count(5, { max: 12 }), 7.6)` returning `8`.
- `fitValues(params, patch)` fits every number in a partial set of values, so a control can pass a raw reading.
- `positionOf(param, v)` and `valueAt(param, position)` convert between a value and a slider position from 0 to 1, on the param's scale.
- `withValues(params, values)` returns the declaration with each param holding its current value, so one object carries a control's kind, range and value.

The declaration is plain data, so it crosses `postMessage` to a worker unchanged. A page that compiles edits off the main thread sends the values, and the worker calls the scene's default export with them.
