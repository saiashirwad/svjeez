import { enter, motion } from "svjeez";
import { voxel } from "svjeez/voxel";

const eye = voxel.camera({ yaw: 45, pitch: 30, unit: 24 });
const stone = voxel.texture({ s: "#888" }, "s");

export const valid = [
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: { side: stone, top: stone }, from: 1, animation: enter({ at: 1, over: 1 }, { y: -8 }) }] }),
  motion(eye.project([1, 2, 3])).to(eye.project([4, 0, 1]), 1),
];

export const invalid = [
  // @ts-expect-error a voxel palette takes hex colors, not named ones
  voxel.texture({ s: "red" }, "s"),
  // @ts-expect-error a block sits on three coordinates
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0], skin: stone }] }),
  // @ts-expect-error a skin that names faces still needs a side to fall back on
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: { top: stone } }] }),
];
