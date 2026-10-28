# @svjeez/geo

Real maps for [svjeez](https://www.npmjs.com/package/svjeez) scenes. It projects GeoJSON or TopoJSON into a scene's frame while the scene compiles, and gives back path data, places, great-circle routes and camera targets in scene pixels. The SVG it ends up in is still one file with no JavaScript.

## Install

```sh
npm i -D @svjeez/geo svjeez
```

Bring your own borders. [`world-atlas`](https://github.com/topojson/world-atlas) and [`us-atlas`](https://github.com/topojson/us-atlas) are good starting points:

```sh
npm i -D world-atlas
```

## Use

```tsx
import { project } from "@svjeez/geo";
import { rect, render } from "svjeez";
import { Camera, flow } from "svjeez/extras";
import { createRequire } from "node:module";

const world = createRequire(import.meta.url)("world-atlas/countries-50m.json");
const map = project(world, { frame: rect(0, 0, 960, 540) });

const newYork = [-74, 40.7] as const;
const london = [-0.13, 51.5] as const;
const route = map.route(newYork, london);
const atlantic = map.bounds([newYork, london], 40);

export default () =>
  render(
    { width: 960, height: 540, duration: 8, title: "New York to London" },
    <Camera frame={rect(0, 0, 960, 540)} stops={[{ during: { at: 2, over: 6 }, target: atlantic }]}>
      <path d={map.land} fill="#1C3A4F" />
      <path d={map.lines} fill="none" stroke="#5D8BA5" strokeWidth={0.6} />
      {flow(route, { at: 3, over: 3, style: "comet" }).node}
    </Camera>,
  );
```

`project(data, options)` takes a TopoJSON topology or a GeoJSON `FeatureCollection` or `Feature`. Its options are:

- `frame` is where the map sits in the scene, in px.
- `projection` is any d3-geo projection. It defaults to `geoNaturalEarth1()`.
- `fit` says what to fit inside `frame`: the regions (the default), `"sphere"` for the whole globe, any GeoJSON object, or `false` to keep the projection's own scale and translation.
- `object` names the TopoJSON object to read. It defaults to the topology's first object.
- `filter` keeps only the features it returns true for, before the map is fitted. Leave Antarctica out with `filter: (f) => f.properties?.name !== "Antarctica"`.
- `tolerance` is the simplification distance in px. It defaults to 0.5.

The map it returns has:

- `regions`, one per feature, each with `id`, `properties`, `feature`, its path data `d`, and the `centroid` and `bounds` of its largest piece. France's centroid sits in France, not out toward French Guiana.
- `region(key)`, a region by `id` or `properties.name`.
- `land`, every region filled as one path. From TopoJSON the shared borders are merged away.
- `lines`, every outline as one path. From TopoJSON each shared border is drawn once.
- `sphere`, the outline of the globe, and `graticule(step)`, lines of longitude and latitude.
- `path(object)`, path data for any other GeoJSON.
- `point([lon, lat])`, a place in scene pixels. It throws for a place the projection clips, such as the far side of an orthographic globe.
- `dots(step)`, evenly spaced places on land for a dot map, each with its `at`, the `id` and `properties` of the feature it sits in, and its `point`. Rows sit `step` degrees of latitude apart (default 2), and dots about `step` degrees of arc apart along a row. On a globe, dots on the far side are kept with an undefined `point`, so a scene can turn them into view.
- `route(from, to)`, the great-circle arc as a list of points, in the form `travel()` and `flow()` take. It throws when the arc crosses the edge of the map; rotate the projection so both ends sit on one side.
- `line(points)`, the path through a list of `[lon, lat]` waypoints along great circles, for a cable or a shipping lane. Where it crosses the edge of the map it is cut, so it returns one list of points per piece.
- `bounds(target, pad)`, a `Rect` for a `Camera` stop around a region, a list that mixes regions and `[lon, lat]` places, or any GeoJSON.

`distance(points)` gives the kilometres along the great circles through a list of places. `sun(date)` gives the `[lon, lat]` where the sun stands overhead, to within about a degree. `night(date)` gives the dark hemisphere as a GeoJSON polygon, ready for `map.path(night(date))`.

## Size

Every path is written for the scene, not the source data. Coordinates round to 0.1px, a point closer than `tolerance` to the last one kept is dropped, points that sit within half the tolerance of a straight line are dropped, and a ring that keeps fewer than three points goes away. Natural Earth's 1:10m countries come to about 150 KB of region paths in a 960 by 540 frame, down from 2.5 MB.

## Zooming a map

Chromium keeps each animated element on its own raster, and when a camera scales hundreds of them it falls behind and flashes blank tiles. Draw a map in with one animated path per region, then hand over to a still copy built from `land` and `lines`, two paths that the camera zooms:

```tsx
<g animation={motion({ opacity: 1 }).at(SWAP).set({ opacity: 0 })}>
  {map.regions.map((r) => <path d={r.d} animation={draw({ at: 0.5, over: 1 })} />)}
</g>
<g animation={motion({ opacity: 0 }).at(SWAP).set({ opacity: 1 })}>
  <Camera frame={frame} stops={stops}>
    <path d={map.land} />
    <path d={map.lines} />
  </Camera>
</g>
```

[`examples/world`](https://github.com/saiashirwad/svjeez/tree/main/examples/world) does this end to end.

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

### Errors

| Error | Fix |
| --- | --- |
| `choropleth() has … values per region but … times in at. Pass one time per value.` | Give `at` one time per entry of each list. |
| `choropleth() needs every region to have the same number of values, got lists of …` | Pad or trim the lists to one length. |
| `cartogram() takes one number per region, but … has a list.` | Pass one time's values. |
| `toBars() needs positive values, got … for …` | Drop zero and negative values first. |
| `cartogram() found no region to draw. Check the keys of values against the map's region ids and names.` | Keys are ids or `properties.name`. world-atlas ids are numeric strings such as `"250"`. |
| `A color scale needs hex colors such as "#1f77b4", got …` | Scales blend hex colors. Names and CSS variables can't be blended. |
| `sequential() needs a domain that rises, got […]` | Put the low value first. |
| `traffic() needs a positive rate, got …` | Pass departures per second above 0. |
| `arc() needs two different places.` | The two ends must not coincide. |

## Not yet

Spinning globes and changing projections change a path's outline over time, which svjeez can't animate yet.
