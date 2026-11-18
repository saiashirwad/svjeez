# @svjeez/geo

Project GeoJSON or TopoJSON into a svjeez scene. Draw maps, routes, data overlays and turning globes.

```sh
npm i -D @svjeez/geo svjeez world-atlas
```

```tsx
import { project } from "@svjeez/geo";
import { render, flow, span } from "svjeez";
import { rect } from "svjeez/geometry";

import { createRequire } from "node:module";

const world = createRequire(import.meta.url)("world-atlas/countries-50m.json");
const map = project(world, { frame: rect(0, 0, 960, 540) });

const newYork = [-74, 40.7] as const;
const london = [-0.13, 51.5] as const;
const route = map.route(newYork, london);

export default () =>
  render(
    { width: 960, height: 540, duration: 8, title: "New York to London" },
    <>
      <path d={map.land} fill="#1C3A4F" />
      <path d={map.lines} fill="none" stroke="#5D8BA5" strokeWidth={0.6} />
      {flow(route, { ...span(1, 4), style: "comet" }).node}
    </>,
  );
```

`world-atlas` supplies the example’s country data. Use `map.point()` to place a label, `map.bounds()` to frame a camera shot, and `choropleth()` or `globe()` for animated data maps and globes.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/flights"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/flights.svg" width="540" alt="Animated routes arc between cities on a map." /></a>

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/geo.md)
