# @svjeez/geo

Maps and turning globes for svjeez. GeoJSON or TopoJSON becomes scene geometry while the scene compiles, so the SVG carries outlines and no script.

```sh
npm i -D @svjeez/geo@next svjeez@next world-atlas
```

```tsx
import { createRequire } from "node:module";
import { project, type Topology } from "@svjeez/geo";
import { Group, Shape, scene, span, track } from "svjeez";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map = project(world, { size: [900, 460] });

export default scene({ size: [960, 540], duration: 4, title: "London to Tokyo" }, () => (
  <Group at={[30, 40]}>
    <Shape geometry={map.land} fill="#1C3A4F" />
    <Shape geometry={map.borders} stroke={{ color: "#5D8BA5", width: 0.5 }} />
    <Shape
      geometry={map.route([-0.13, 51.51], [139.69, 35.69])}
      stroke={{ color: "#F4B740", width: 2 }}
      draw={track(0).to(1, span(0.5, 2))}
    />
  </Group>
));
```

`globe()` turns a globe over a span, with night, routes and places that ride it. `world-atlas` supplies the example's countries.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/geo.md)
