# `@svjeez/geo`

Project GeoJSON or TopoJSON into flat maps (`project`) or rotating globes (`globe` + `<GlobeShape>`) with routes, dot maps, pins, and day/night terminators.

## Setup

```sh
npm install @svjeez/geo world-atlas svjeez
```

- `d3-geo` and `topojson-client` are bundled; `world-atlas` is not—install it if you want world TopoJSON (`countries-110m.json`, `countries-50m.json`, `land-110m.json`).
- Load TopoJSON in Node/Bun with `createRequire(import.meta.url)("world-atlas/countries-110m.json") as Topology`.
- Common d3 projections (`geoNaturalEarth1`, `geoEqualEarth`, `geoOrthographic`, `geoMercator`, `geoEquirectangular`, `geoAlbersUsa`, `geoAzimuthalEqualArea`, `geoConicEqualArea`) are re-exported from `@svjeez/geo`.

## Mental model

- **Run `project()` / `globe()` at module top level:** Both compute geometry eagerly; place the resulting elements inside `<Group offset={[x, y]}>` (maps draw from `[0, 0]` to `size`, globes around `[0, 0]` with `radius`).
- **Coordinates are `[longitude, latitude]` (longitude first):** Swapped values within `[-90, 90]` silently plot in the wrong spot; out-of-range latitudes throw.
- **Flat map (`project`) returns `Geometry`:** Pass `map.land`, `map.borders`, `map.sphere`, `map.graticule(step)`, `map.route(a, b)`, and `map.region(idOrName).geometry` straight to `<Shape geometry={...} />`. Place pins at `map.point(lonLat)`. Default `fit: "regions"` includes Antarctica—filter it out with `filter: (f) => f.properties?.name !== "Antarctica"` when desired.
- **Globe (`globe`) returns `Turning` objects:** Draw `earth.land`, `earth.borders`, `earth.graticule()`, `earth.route()`, `earth.night()`, and `earth.terminator()` with `<GlobeShape of={...} fill|stroke />` (never `<Shape geometry>`). Only `earth.sphere` is a plain `Geometry`.
- **Rotation and riding pins:** Pass `turn: { by: -360, over: span(0, T) }` for one full west-to-east turn (scene `duration >= T`). Attach city markers with `<Group {...earth.place([lon, lat])}>` (sets `offset` and limb-faded `opacity`). Tune SVG size on turning globes with `simplify` (deg, default `0.6`), `step` (deg, `6`), and `tolerance` (px, `1`).
- **TopoJSON vs GeoJSON:** `.borders` requires TopoJSON shared arcs and throws on plain GeoJSON. Region lookup (`region(key)`) matches exact `id` or exact `properties.name` (case-sensitive).

## API map

| Export | Summary |
|---|---|
| `project(data, { size, projection?, fit?, tolerance?, object?, filter? })` | Returns `GeoMap`: `size`, `projection`, `land`, `borders`, `sphere`, `regions`, `region(key)`, `shape(geo)`, `point(lonLat)`, `route(a, b)`, `graticule(step?)`, `dots(step?)`. |
| `globe(data, { radius, facing, turn?, simplify?, step?, tolerance?, object?, filter? })` | Returns `Globe`: `radius`, `sphere`, `land`, `borders`, `regions`, `region(key)`, `shape(geo)`, `graticule(step?)`, `circle(center, deg)`, `route(a, b)`, `night(dateOrFn)`, `terminator(dateOrFn)`, `place(at, { fade? })`, `facing(t)`, `locate(at, t)`. |
| `<GlobeShape of fill? stroke? ... />` | Renders a `Turning` from `globe()`, clipped to the globe disc. |
| `sun(date)`, `night(date)` | Subsolar `LonLat` and night-hemisphere GeoJSON `Polygon`. |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { createRequire } from "node:module";
import { geoNaturalEarth1, project, type Topology } from "@svjeez/geo";
import { Group, Shape, circle, ease, enter, scene, span, tokens, track } from "svjeez";

const theme = tokens({
  light: { background: "#FFFFFF", raised: "#EEF1F6", cyan: "#007A87", orange: "#D95D00" },
  dark: { background: "#090A0C", raised: "#161920", cyan: "#5CE1E6", orange: "#FF9F43" },
});

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map = project(world, {
  size: [600, 300],
  projection: geoNaturalEarth1(),
  filter: (f) => f.properties?.name !== "Antarctica",
});
const london = map.point([-0.13, 51.51]);

export default scene(
  { size: [640, 340], duration: 3.5, title: "Flat map", desc: "A route draws from London to Tokyo.", theme, still: 3, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group offset={[20, 20]}>
        <Shape geometry={map.sphere} fill={theme.raised} />
        <Shape geometry={map.land} fill={theme.cyan} opacity={0.6} />
        <Shape geometry={map.borders} stroke={{ color: theme.background, width: 0.5 }} />
        <Shape
          geometry={map.route([-0.13, 51.51], [139.69, 35.69])}
          stroke={{ color: theme.orange, width: 2 }}
          draw={track(0).to(1, span(0.5, 2))}
        />
        <Shape geometry={circle(4)} offset={london} fill={theme.orange} motion={enter(span(0.2, 0.4), { from: { scale: 0 }, curve: ease.pop })} />
      </Group>
    </Group>
  ),
);
```

## Gotchas

- `undefined is not an object (evaluating 'box.x')` on `earth.land` → Pass `Turning` values from `globe()` to `<GlobeShape of={earth.land} ... />`, not `<Shape geometry>`.
- `Two nodes are both keyed "356" inside <Group>` → `region.id` values are numeric strings (e.g. `"356"` for India) that collide with numeric loop keys; prefix keys (`key={`d${i}`}`, `key={`r${r.id}`}`).
- `route(...) crosses the edge of the map` → Rotate the flat projection so both endpoints sit on one side: `geoNaturalEarth1().rotate([-150, 0])`.
- `has no region "france"` → Match exact case (`"France"`) or ISO numeric `id`; inspect `map.regions.map(r => r.name)`.
- `reads borders only from TopoJSON` → Omit `.borders` when using plain GeoJSON.
- `latitude … is past a pole` → Pass `[longitude, latitude]` (longitude first).
