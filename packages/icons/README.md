# @svjeez/icons

[Tabler](https://tabler.io/icons) and [Lucide](https://lucide.dev) icons as plain path data for [svjeez](https://www.npmjs.com/package/svjeez) scenes. The package has no dependencies and does not import svjeez. Each icon is an object, so a bundler or compiler keeps only the ones you import.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/icons"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/icons.svg" width="480" alt="Seven Tabler outline icons draw themselves in one stroke at a time, then a filled heart pops into the last place in the grid." /></a>
  <br /><sub>Tabler icons drawn on stroke by stroke with <code>&lt;Icon&gt;</code></sub>
</p>

## Install

```sh
npm i -D @svjeez/icons svjeez
```

## Use

```tsx
import { rocket, checkFilled } from "@svjeez/icons/tabler";
import { circle } from "@svjeez/icons/lucide";
import { Icon, draw } from "svjeez";

const scene = (
  <Icon
    icon={rocket}
    x={40}
    y={40}
    size={48}
    stroke="#fff"
    animation={(_, i) => draw({ at: 0.2 + i * 0.1, over: 0.6 })}
  />
);
```

`<Icon>` comes from `svjeez`. This package only holds the data.

## The data

```ts
interface Icon {
  readonly grid: number; // side of the square viewBox the paths are drawn on
  readonly kind: "stroke" | "fill"; // outlines to stroke, or shapes to fill
  readonly paths: readonly string[]; // one path per drawn piece, in source order
}
```

The type is exported from `@svjeez/icons`. A path is one piece of the drawing, so each can animate on its own: the shaft of an arrow and its head are two paths.

## Sets

| Import | Icons | Kind |
| --- | --- | --- |
| `@svjeez/icons/tabler` | 6257 | Outline icons are `stroke`. Filled icons are `fill` and end in `Filled`, as in `heartFilled`. |
| `@svjeez/icons/lucide` | 2193 | All `stroke`. |

Both sets draw on a 24 unit grid with a 2 unit stroke.

## Names

An icon's file name becomes a camelCase export: `arrow-left` is `arrowLeft`. Two rules cover the names that would break:

- A hyphen between two digits becomes an underscore, so `arrow-up-1-0` is `arrowUp1_0` and stays apart from `arrow-up-10`.
- A name that is not a valid identifier, or is a reserved word, gets an `icon` prefix: `delete` is `iconDelete`, `package` is `iconPackage`.

The generator fails if two icons end up with one name.

## Conversion

Lucide draws some icons with `circle`, `ellipse`, `rect`, `line`, `polyline` and `polygon`. The generator rewrites each to path data. Tabler's invisible `M0 0h24v24H0z` frame is dropped. The generator stops on an element or attribute it does not know, so an upstream change that moves geometry cannot slip through.

Some outline icons carry a solid piece, such as the dots of Lucide's `galaxy` or the lit half of Tabler's `brightnessHalf`. They stay `stroke` icons, so that piece draws as an outline. Tabler's `brand-parsinta` loses the half opacity of one path.

## Regenerate

```sh
bun run generate
```

reads `@tabler/icons` and `lucide-static` from `node_modules` and rewrites `src/tabler.ts` and `src/lucide.ts`, sorted by name, so a rerun with the same upstream versions changes nothing. The upstream versions are pinned in `package.json`. Each generated file starts with its upstream licence: Tabler is MIT and Lucide is ISC. This package is MIT.
