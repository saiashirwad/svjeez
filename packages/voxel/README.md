# @svjeez/voxel

Pixel-art voxel scenes for [svjeez](https://www.npmjs.com/package/svjeez). Blocks sit on a grid, each face wears a small texture, and a fixed camera projects them into one SVG that animates through CSS. Nothing runs in the viewer's browser.

This used to be `svjeez/voxel`. Import `voxel` from `@svjeez/voxel` instead; the subpath is gone and `svjeez/extras` never exported it.

## Install

```sh
npm i -D @svjeez/voxel svjeez
```

## Use

```tsx
import { enter, ease, render } from "svjeez";
import { voxel } from "@svjeez/voxel";

const view = voxel.camera({ yaw: 45, pitch: 30, unit: 24 });
const dirt = voxel.texture({ d: "#7A5534", e: "#6A4A2C" }, `
  dded
  dddd
  edde
  dddd
`);

export default () =>
  render(
    { width: 300, height: 220, duration: 4, title: "Island" },
    <g transform="translate(150 110)">
      {voxel.scene({
        camera: view,
        blocks: [
          { at: [0, 0, 0], skin: dirt },
          { at: [1, 0, 0], skin: dirt, from: 1, animation: enter({ at: 1, over: 0.6 }, { y: -30 }, ease.pop) },
        ],
      })}
    </g>,
  );
```

`voxel.camera` fixes the view, `voxel.texture` parses a pixel grid from a palette of hex colors, and `voxel.scene` draws the visible faces. A block's `from` and `to` set when it shows; `animation` moves it.

See the [voxel reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/voxels.md) and the [minecraft example](https://github.com/saiashirwad/svjeez/tree/main/examples/minecraft).
