import assert from "node:assert/strict";
import { voxel } from "@svjeez/voxel";
import { render } from "svjeez";

const camera = voxel.camera({ yaw: 45, pitch: 30, unit: 12 });
const stone = voxel.texture({ s: "#888888" }, "s");

const svg = render(
  { width: 200, height: 200, duration: 2, title: "Voxel" },
  voxel.scene({ camera, blocks: [{ at: [0, 0, 0], skin: stone }] }),
);

assert.match(svg, /^<svg[\s\S]*<use href="#/);

assert.throws(
  () => voxel.scene({ camera, blocks: [{ at: [0.5, 0, 0], skin: stone }] }),
  /whole cells/,
);

console.log(`rendered a voxel scene into ${(svg.length / 1024).toFixed(1)} KB`);
