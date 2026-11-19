# @svjeez/geo

Maps and rotating globes for `svjeez`. Projects GeoJSON or TopoJSON into SVG geometry at compile time with zero viewer script.

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

Use `globe()` to spin a globe over a span, with optional night shading, great-circle routes, and pinned markers.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/geo.md)
