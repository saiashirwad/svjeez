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
- `route(from, to)`, the great-circle arc as a list of points, in the form `travel()` and `flow()` take. It throws when the arc crosses the edge of the map; rotate the projection so both ends sit on one side.
- `bounds(target, pad)`, a `Rect` for a `Camera` stop around a region, a list that mixes regions and `[lon, lat]` places, or any GeoJSON.

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

## Not yet

Spinning globes and changing projections change a path's outline over time, which svjeez can't animate yet.
