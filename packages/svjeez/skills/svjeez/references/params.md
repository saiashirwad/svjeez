# Params: a scene is a template

A scene can be a function of its params. It exports a schema as `params`, built with `param` from `svjeez`, and its default export takes the values and returns the scene. The CLI and your own build call it with values of their own.

```tsx
/** @jsxImportSource svjeez */
import { Group, Shape, Text, enter, param, rect, scene, span } from "svjeez";
import { defaults, type Values } from "svjeez/tools";
import { sans, theme } from "./style";

export const params = {
  title: param.text("Weekly signups", { maxLength: 24 }),
  bars: param.list(param.number(0, { min: 0, max: 100 }), [40, 70, 55], { min: 1, max: 6 }),
};

export default (p: Values<typeof params> = defaults(params)) =>
  scene({ size: [320, 160], duration: 3, title: p.title, theme, loop: false }, (canvas) => {
    const rise = span(0.2, 0.4).cascade(p.bars.length, 0.1);

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Text font={sans} size={14} at={[16, 12]} fill={theme.text}>{p.title}</Text>
        {p.bars.map((value, i) => (
          <Shape geometry={rect(30, value)} at={[16 + i * 40, 140]} anchor="bottom-left" fill={theme.blue} motion={enter(rise[i]!)} />
        ))}
      </Group>
    );
  });
```

Keep the default argument `p = defaults(params)`, so the module renders when nothing passes values. Draw for every value the schema allows: `maxLength` and a list's `max` are how the layout knows what fits. Derive time from the data (`span(…).cascade(p.bars.length, step)`), never fixed seconds per item.

## Calling it

- **The CLI.** Every command (`svg`, `frames`, `check`, `video`, `dev`) takes `--params data.json`, checks it against the module's `params` and calls the default export with the result. `--param key=value` (repeatable) sets one value that is not a list, over the file. A key left out keeps its default. A key the schema doesn't declare is an error that lists the ones it does.
- **Your build.** `parse(params, json)` from `svjeez/tools` does what the CLI does: `build(parse(params, JSON.parse(text)))`.

```sh
npx svjeez check card.tsx --params release.json --param title=Hello
npx svjeez svg card.tsx --params release.json --out card.svg
```

## Kinds

| Call | Value |
| --- | --- |
| `param.number(value, { min, max, step?, unit?, scale?, label? })` | a number in `[min, max]` |
| `param.count(value, { min?, max })` | a whole number |
| `param.seconds(value, { min?, max })` | a time |
| `param.color(value)` | a hex color |
| `param.easing(value)` | an ease from `ease` |
| `param.choice(value, options)` | one of `options`, typed as their union |
| `param.text(value, { maxLength? })` | a string |
| `param.list(item, value, { min?, max? })` | an array of one scalar param, or of a record of them |

Every kind takes an optional `label`. `defaults(params)` returns every declared value, typed as `Values<typeof params>`. `parse(params, json)` reads untrusted input and throws on a wrong type, a value out of range, a list too long, or an unknown key, naming the path.
