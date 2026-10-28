# Voxels

Voxels live in their own entry, `svjeez/voxel`. It exports `voxel` with `camera`, `texture` and `scene`.

```tsx
import { ease, enter, sampled } from "svjeez";
import { voxel } from "svjeez/voxel";

const view = voxel.camera({ yaw: 45, pitch: 30, unit: 24 }); // unit: px per block edge
const dirt = voxel.texture({ d: "#7A5534", e: "#6A4A2C" }, `
  dded
  dddd
  edde
  dddd
`);
const grass = voxel.texture({ g: "#5DA03A", d: "#7A5534" }, `
  gggg
  gdgg
  dddd
  dddd
`);

const island = (
  <g transform="translate(300 160)">
    {voxel.scene({
      camera: view,
      blocks: [
        { at: [0, 0, 0], skin: { side: dirt, top: grass } },
        { at: [1, 0, 0], skin: dirt, from: 3, to: 9 }, // visible from 3s until 9s
        { at: [0, 0, 1], skin: dirt, from: 1, animation: enter({ at: 1, over: 0.6 }, { y: -30 }, ease.pop) },
      ],
    })}
  </g>
);

const flyer = sampled((t) => view.project([2, 3 - t, 1]), { duration: 3, tolerance: { translate: 0.5 } }); // a free point
```

- Coordinates are whole cells, `y` up. The cube spans `at` to `at + 1`.
- `yaw` turns about `y`; 45 looks from +x +z. `pitch` is between 0 and 90 exclusive: 30 is the 2:1 pixel-art look, 35.264 is true isometric.
- A texture is pixel art. Each line is a row and each character a palette key. A `null` palette value is a transparent pixel. Colors are `#rgb`, `#rrggbb` or `#rrggbbaa`.
- A skin is one texture for every face, or `{ side, top?, north?, south?, east?, west? }`, where a missing face falls back to `side`.
- Blocks draw back to front. Two blocks in one cell keep array order, so an overlay is a second block on the cell.
- `from` and `to` own the block's opacity, so a block's `animation` cannot animate it.
- Blocks fully hidden by opaque, unanimated neighbours are not drawn.
- `view.project([x, y, z])` returns a `{ x, y }` screen point in the scene's `x` and `y` channels, so it feeds `sampled()` and `travel()` directly.

Errors read `voxel.scene() needs blocks on whole cells, got [...]`, `voxel.scene() needs 0 <= from < to, ...`, `camera() needs a pitch between 0 and 90 degrees, got ...`, and `texture() row 1 uses "x", which the palette lacks.`
