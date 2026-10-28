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

## Data maps

Color regions from numbers, play them through time, and morph the map into a cartogram or a bar chart. Import from `@svjeez/geo`. `examples/choropleth` in the svjeez repository plays life expectancy through 1960 to 2020, then morphs it into a population cartogram and a bar chart. The data is World Bank (SP.DYN.LE00.IN, SP.POP.TOTL) and is named in the scene's `desc`.

A scale turns a number into one of `steps` colors (default 9). Colors are hex, blended in OKLab. `palettes` has `viridis`, `magma`, `blues`, `redBlue` and `brownTeal`.

```tsx
const scale = sequential(palettes.viridis, { domain: [35, 85], steps: 10, empty: "#2a343f" });
const hot = diverging(palettes.redBlue, { domain: [-5, 0, 5] });
const key = legend(scale, { x: 40, y: 480, width: 360, title: "Life expectancy (years)", empty: "No data" });
```

`choropleth(map, values, { scale, at, over, lines })` keys `values` by region id or `properties.name`. A number is one frame. A list is one value per time in `at`, and the map fades from `scale.empty` into the first frame unless that time is 0. Regions whose colors follow the same course share one path, so the file stays small. It returns `{ node, unmatched, groups }`. `unmatched` lists keys that match no region.

```tsx
const years = choropleth(map, { "250": [78, 82], "276": [77, 81] }, { scale, at: [0.5, 3], lines: "#0b1118" });
```

`cartogram(map, values, { at, over, fill, coverage, detail, stagger })` sizes a circle per region by area, places it at the centroid, and pushes the circles apart. Each outline morphs into its circle through `matchPaths()` and the `d` channel. `toBars(map, values, { frame, at, top, order, max })` morphs the biggest `top` regions into horizontal bars in `frame`. Both take one positive number per region and return `{ node, rest }`, with `bubbles` or `bars` (each `{ region, value, rect }`) to place labels from. `fill` is a color or `(region, value) => color`.

The shapes start as the outline and hide until `at`. Keep the map under them and fade it out over the morph so nothing pops. Each region's outline is thinned to `detail` px (default 2.5), and pieces under a few px are left behind, because a morph stores every point several times. A world cartogram is about 600 KB. Raise `detail` for a smaller file.

## Traffic

`traffic(lines, { during, rate, seed, speed, style, color, size, back })` sends `rate` particles a second over the span `during`. Each takes a route picked by `weight` (a line is a list of points, or `{ points, weight, color }`) and leaves at a jittered moment, so they spread out. The same seed gives the same file. Each particle is a `flow()` token, so `style` is `dot`, `comet`, `trace` or `packet`. `back` is the share, 0 to 1, that run their route backward. It returns `{ node, count, end }`.

`arc(map, from, to, { height })` returns a curved route for a flat map, bowed up the page by `height` px, as points for `traffic()`, `flow()` and `travel()`. `from` and `to` are `[lon, lat]` or points.

```tsx
const routes = flights.map(([a, b]) => ({ points: arc(map, a, b), weight: 3 }));
const { node } = traffic(routes, { during: { at: 1, over: 8 }, rate: 6, seed: 4, style: "comet", size: 2.5 });
```

Particles still in flight at the end of the scene fail the scene's length check, so end `during` a trip's length before the scene ends.

## Errors

| Error | Fix |
| --- | --- |
| `route() from … to … crosses the edge of the map` | Rotate the projection so both ends sit on one side: `geoNaturalEarth1().rotate([-150, 0])`. |
| `point(…) falls outside the projection` | The place is on the far side of a globe or outside the clip. Rotate the projection toward it. |
| `project() has no region …` | Use the feature's `id` or its `properties.name`. world-atlas ids are ISO 3166 numeric codes as strings. |
| `choropleth() has … values per region but … times in at. Pass one time per value.` | Give `at` one time per entry of each list. |
| `choropleth() needs every region to have the same number of values, got lists of …` | Pad or trim the lists to one length. |
| `cartogram() takes one number per region, but … has a list.` | Pass one time's values. |
| `toBars() needs positive values, got … for …` | Drop zero and negative values first. |
| `cartogram() found no region to draw. Check the keys of values against the map's region ids and names.` | Keys are ids or `properties.name`. world-atlas ids are numeric strings such as `"250"`. |
| `A color scale needs hex colors such as "#1f77b4", got …` | Scales blend hex colors. Names and CSS variables can't be blended. |
| `sequential() needs a domain that rises, got […]` | Put the low value first. |
| `traffic() needs a positive rate, got …` | Pass departures per second above 0. |
| `arc() needs two different places.` | The two ends must not coincide. |
| `globe() with a spin function needs a duration, as in { duration: 24 }.` | Pass `duration` beside a function `spin`. |
| `globe() found no parallel behind the globe clear of every outline …` | Tilt the globe further, simplify less, or filter out shapes that cross every parallel. |
| `globe().borders() needs TopoJSON, which knows which edges two regions share.` | Load TopoJSON, or draw outlines with `path()`. |
| `reproject() puts … far outside the frame under projection ….` | Filter that region out: Mercator stretches the poles without end. |
| `reproject() needs at least two projections.` | Pass two or more projections. |
| `trueSize() needs a region with polygons.` | Pass a region or polygon feature. |
