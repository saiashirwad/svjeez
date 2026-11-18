# Maps and globes

`@svjeez/geo` (`npm i @svjeez/geo@next world-atlas`) turns GeoJSON or TopoJSON into geometry for `<Shape>` while the scene compiles. A place is `[longitude, latitude]` in degrees, longitude first. `world-atlas` has the world's countries (`countries-110m.json`, or `-50m` for finer coasts).

## Flat maps

```tsx
import { createRequire } from "node:module";
import { geoEqualEarth, project, type Topology } from "@svjeez/geo";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map = project(world, { size: [900, 460], projection: geoEqualEarth(), fit: "sphere" });
const brazil = map.region("Brazil");

<Group offset={[30, 40]}>
  <Shape geometry={map.sphere} fill={theme.surface} />
  <Shape geometry={map.land} fill={theme.cyan} />
  <Shape geometry={map.borders} stroke={{ color: theme.background, width: 0.5 }} />
  <Shape geometry={brazil.geometry} fill={theme.green} />
  <Text font={mono} size={11} fill={theme.text} at={brazil.center} anchor="center">Brazil</Text>
  <Shape geometry={map.route(london, tokyo)} stroke={{ color: theme.orange, width: 2 }} trim={draw(span(0.5, 2))} />
  <Shape geometry={circle(4)} at={map.point(london)} anchor="center" fill={theme.red} />
</Group>
```

- `project(data, { size, projection, fit, object, filter, tolerance })` draws the map from `[0, 0]` to `size`; place it with a `<Group offset>`. `projection` is any d3-geo projection (default `geoNaturalEarth1()`; the common ones are exported). `fit` is `"regions"` (default), `"sphere"` for the whole globe, or `false` to keep the projection's own scale. `filter` drops features, such as Antarctica. `tolerance` is the px a point must move to be kept (default 0.5).
- Geometry: `land`, `borders` (edges two regions share, from TopoJSON only), `sphere` (the map's outline), `graticule(step)`, `shape(geojson)` for anything else, such as `shape(night(date))`, and `route(from, to)`, a great-circle line that `trim={draw(span)}` draws on.
- Places: `point(at)` is a point for `at`; `regions` and `region(nameOrId)` give each region's `geometry`, `center` (on its largest piece) and `box`; `dots(step)` lays a dot every `step` degrees on land, for a dot map.
- A region's geometry is a geometry like any other: a track of them morphs, so `track(region.geometry).to(moved(circle(r), region.center), span)` turns a country into a bubble.

## Turning globes

```tsx
import { GlobeShape, globe, sun } from "@svjeez/geo";

const hour = (t: number) => new Date(Date.UTC(2026, 5, 21) + t * 3_600_000);
const earth = globe(world, { radius: 220, facing: [-30, 22], turn: { by: -360, over: span(0, 24) } });

<Group offset={[650, 270]}>
  <Shape geometry={earth.sphere} fill={theme.surface} />
  <GlobeShape of={earth.land} fill={theme.cyan} />
  <GlobeShape of={earth.night(hour)} fill="#000000" opacity={0.5} />
  <GlobeShape of={earth.route(london, tokyo)} stroke={{ color: theme.orange, width: 2 }} />
  <Group {...earth.place(london)}>
    <Shape geometry={circle(3)} fill={theme.orange} />
  </Group>
</Group>
```

- `globe(data, { radius, facing, turn, simplify, step, tolerance })` is drawn around `[0, 0]`: put it in a `<Group offset>`. `facing` is the place at the globe's middle when the turn starts; its latitude tilts the pole toward the viewer. `turn: { by, over }` turns it `by` degrees of longitude over a span; `by: -360` is one day, west to east, and loops seamlessly. Without `turn` the globe stands still.
- Draw everything on the globe with `<GlobeShape of={…}>`, which takes a shape's `fill`, `stroke`, `trim` and every node prop but `geometry` and `clip`: it clips to the disc, so the far side never shows. `of` takes `land`, `borders`, `region(name).outline`, `shape(geojson)`, `graticule(step)`, `circle(at, degrees)`, `route(from, to)`, `night(date)` and `terminator(date)`. A date may be a function of the turn's seconds, so night moves with time.
- `sphere` is the disc, for the sea and the rim. `place(at, { fade })` returns `offset` and `opacity` for a `<Group>`: its `[0, 0]` rides the globe and fades out over the horizon, holding still while hidden.
- `sun(date)` is the place under the sun; `night(date)` is the dark half as GeoJSON for a flat map's `shape()`.
- `simplify` (degrees, default 0.6) and `tolerance` (px, default 1) trade detail for bytes: every outline on a turning globe is a path with many keys, so a globe is the largest thing a scene can hold. Use `countries-110m`, one `land`, and few `borders`.

Errors name the call and what to write: a region that doesn't exist suggests the exact name, a place past a pole asks for longitude first, `borders` from GeoJSON asks for TopoJSON, and a route across a flat map's edge asks to rotate the projection. The repository's `examples/globe` is a whole scene.
