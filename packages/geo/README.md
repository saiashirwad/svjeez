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

## Turning globes

`globe(data, { frame, tilt, spin })` turns an orthographic globe whose land, borders, grid, routes and night side are real paths. Each is a `sampledPath()` from svjeez with a fixed point count. A point behind the globe is folded out past the rim rather than clipped, so a ring keeps its points as it crosses the horizon, and the fold runs around the hidden pole, or a clear parallel, so no ring wraps the wrong way. Clip every layer to `globe.sphere`.

```tsx
const earth = globe(world, { frame, tilt: 22, spin: { from: 0, to: -360, over: 24 } });

<g clipPath={def.clipPath({}, <path d={earth.sphere} />)}>
  {earth.land().map((piece) => <path {...piece} fill="#9fcbea" />)}
  <path {...earth.night(date)} fill="#000" opacity={0.6} />
</g>
<g {...earth.place([-0.13, 51.5])}><circle r={3} /></g>
```

`land()`, `borders()`, `graticule(step)` and `path(geojson)` come back in pieces 30 degrees of longitude wide, so a piece behind the globe holds still. `route(from, to)`, `circle(center, radius)`, `night(date)` and `terminator(date)` come back as one path. `place(at)` moves a group's `x`, `y` and `opacity` so a marker rides the globe and fades at the horizon. Outlines are simplified on the sphere to `simplify` degrees (default 0.6), and `tolerance` (default 1px) sets how closely each replay follows the turn. [`examples/globe`](https://github.com/saiashirwad/svjeez/tree/main/examples/globe), one turn of 110m land with night and eight cities at `simplify: 0.8`, is 585 KB.

## Changing projection

`reproject(data, projections, { frame, filter })` writes each region under every projection from the same points, simplified once in degrees and cut at the antimeridian, so `motion({ d })` morphs from one to the next. `regions[i].d[k]` is region `i` under projection `k`, and `land[k]` is every region in one path. Mercator can't fit Antarctica; filter it out.

`trueSize(map, region, to, { at, over })` slides a region's real outline across the globe to `to` and draws it through the map's projection at every step. On Mercator, Greenland shrinks as it reaches the equator. `nightfall(map, (t) => date, { duration })` moves the night side of a flat map through a day or a year as one shape, a column of darkness per longitude, so it holds together across an equinox. [`examples/projections`](https://github.com/saiashirwad/svjeez/tree/main/examples/projections) morphs Mercator to Equal Earth and slides Greenland to Africa.
