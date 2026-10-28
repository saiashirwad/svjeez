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

Dots turn more cheaply than paths, through CSS alone. Register `lat` and `lon` with `def.property`, put them on each dot's `style`, animate one `yaw` angle on the group around them, and let a `css` rule place every dot with `sin` and `cos`. `examples/earth` in the svjeez repository turns 1,393 dots through a day and lights cities by the sun's angle this way.

## Turning globes

`globe(data, { frame, tilt, spin: { from, to, over } })` turns a globe whose outlines are real paths. `from` and `to` are the longitude at the middle; a day turns from `lon` to `lon - 360`. Every layer is a `sampledPath()` with a fixed point count: the hidden side folds out past the rim instead of being clipped, so clip every layer to `globe.sphere`.

```tsx
const earth = globe(world, { frame: rect(430, 44, 452, 452), tilt: 22, spin: { from: 0, to: -360, over: 24 } });
const clip = def.clipPath({}, <path d={earth.sphere} />);

<path d={earth.sphere} fill="#0b1a2c" />
<g clipPath={clip}>
  {earth.land().map((piece) => <path {...piece} fill="#9fcbea" />)}
  <path {...earth.night((t) => new Date(day + t * 3_600_000))} fill="#000" opacity={0.6} />
</g>
{cities.map((c) => <g {...earth.place(c.at)}><circle r={3} /></g>)}
```

- `land()`, `borders()`, `graticule(15)` and `path(geojson)` return pieces a band of longitude wide, so a piece behind the globe costs no keys. Spread each onto a `<path>`.
- `route(from, to)`, `circle(center, degrees)`, `night(date)` and `terminator(date)` return one path each. `date` is a `Date` or a function of time.
- `place(at)` gives a `<g>` a moving `x`, `y` and `opacity`, so a marker rides the globe and fades out at the horizon. Draw its content at the origin.
- `simplify` (default 0.6 degrees) and `tolerance` (default 1px) set the file size. One turn of 110m land in 24s with a 226px radius is about 500 KB at `simplify: 0.8`. Tilt the globe 20 degrees or more so its hidden pole holds the fold; an upright globe needs more keys.
- `spin` also takes `(t) => [lon, lat]` with a `duration`.

`examples/globe` in the svjeez repository turns a day this way. The dot globe above stays smaller for a long loop.

## Changing projection

`reproject(data, [geoMercator(), geoEqualEarth()], { frame, filter })` writes every region under each projection from the same points, so `motion({ d })` morphs between them. `regions[i].d[k]` is region `i` under projection `k`, and `land[k]` fills everything. Outlines are cut at the antimeridian and simplified once, in degrees. Filter out Antarctica for Mercator.

```tsx
const maps = reproject(world, [geoMercator(), geoEqualEarth()], { frame, filter });
const [a, b] = maps.land;
<path d={a} animation={motion({ d: a }).at(1).to({ d: b }, 1.8, ease.inOut)} />;
```

`trueSize(map, region, [lon, lat], { at, over })` slides a region's real outline across the globe and draws it through the map's projection at every step, so Greenland shrinks on Mercator as it reaches the equator. Pass the same projection to `project()` with `fit: false` to land it on a reprojected map. `nightfall(map, (t) => date, { duration })` moves the night side of a flat map through a day or a year with one fixed shape, even across an equinox. `examples/projections` does the Mercator morph and the slide.

## Errors

| Error | Fix |
| --- | --- |
| `route() from … to … crosses the edge of the map` | Rotate the projection so both ends sit on one side: `geoNaturalEarth1().rotate([-150, 0])`. |
| `point(…) falls outside the projection` | The place is on the far side of a globe or outside the clip. Rotate the projection toward it. |
| `project() has no region …` | Use the feature's `id` or its `properties.name`. world-atlas ids are ISO 3166 numeric codes as strings. |
| `globe() with a spin function needs a duration, as in { duration: 24 }.` | Pass `duration` beside a function `spin`. |
| `globe() found no parallel behind the globe clear of every outline …` | Tilt the globe further, simplify less, or filter out shapes that cross every parallel. |
| `globe().borders() needs TopoJSON, which knows which edges two regions share.` | Load TopoJSON, or draw outlines with `path()`. |
| `reproject() puts … far outside the frame under projection ….` | Filter that region out: Mercator stretches the poles without end. |
| `reproject() needs at least two projections.` | Pass two or more projections. |
| `trueSize() needs a region with polygons.` | Pass a region or polygon feature. |
