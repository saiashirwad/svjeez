# Real maps with @svjeez/geo

`@svjeez/geo` is a separate package: `npm i -D @svjeez/geo world-atlas`. It projects GeoJSON or TopoJSON into the scene's frame while the scene compiles, and returns path data and points in scene pixels.

```tsx
import { project, type LonLat } from "@svjeez/geo";
import { createRequire } from "node:module";

const world = createRequire(import.meta.url)("world-atlas/countries-50m.json");
const map = project(world, {
  frame: rect(24, 24, 912, 492),
  filter: (f) => f.properties?.name !== "Antarctica",
});
```

- `projection` takes any d3-geo projection; the default is `geoNaturalEarth1()`. `fit: "sphere"` fits the whole globe instead of the regions.
- `map.regions` holds `{ id, properties, feature, d, centroid, bounds }` per feature. `map.region("France")` finds one by `id` or `properties.name`. `centroid` and `bounds` describe the largest piece, so labels and zooms land on the mainland.
- `map.land` fills every region in one path. `map.lines` strokes every border once. `map.sphere` and `map.graticule(15)` draw the globe and its grid.
- `map.point([lon, lat])` places a marker or label. Longitude comes first.
- `map.dots(step)` returns evenly spaced places on land, `{ at, id, properties, point }`, for a dot map. On a globe, far-side dots keep their `at` and have no `point`.
- `sun(date)` is the `[lon, lat]` under the overhead sun, and `night(date)` the dark hemisphere as GeoJSON for `map.path()`.
- `map.route(from, to)` returns the great-circle arc as points for `travel()` and `flow()`. Draw it with `<path d={...}>` and `draw()`; `draw` needs no `strokeDasharray` of its own.
- `map.line([a, b, c])` runs great circles through waypoints and returns one point list per piece, cut where it crosses the map's edge. `distance([a, b, c])` gives its length in km. `examples/cables` lays submarine cables this way.
- `map.bounds(region)`, `map.bounds([region, [lon, lat], ...], pad)` and `map.bounds(geojson)` return a `Rect` for a `Camera` stop.
- `tolerance` (default 0.5px) sets how hard paths are simplified. Raise it for a small scene.

## Zooming

Don't zoom a camera over one animated path per country: Chromium flashes blank tiles. Animate the per-region paths for the intro, then at a fixed time hide them and show a still copy of `map.land` and `map.lines` inside the `Camera`. Put markers and routes in a second `Camera` with the same stops. `examples/world` in the svjeez repository does this.

Animate a region's color with `motion({ fill: "#123" }).to({ fill: "#456" }, 0.6)`; `fillOpacity` is not a channel.

## Turning a globe

A globe's paths can't turn, but its dots can. Register `lat` and `lon` with `def.property`, put them on each dot's `style`, animate one `yaw` angle on the group around them, and let a `css` rule place every dot with `sin` and `cos`. `examples/earth` in the svjeez repository turns 1,879 dots through a day and lights cities by the sun's angle this way.

## Errors

| Error | Fix |
| --- | --- |
| `route() from … to … crosses the edge of the map` | Rotate the projection so both ends sit on one side: `geoNaturalEarth1().rotate([-150, 0])`. |
| `point(…) falls outside the projection` | The place is on the far side of a globe or outside the clip. Rotate the projection toward it. |
| `project() has no region …` | Use the feature's `id` or its `properties.name`. world-atlas ids are ISO 3166 numeric codes as strings. |
