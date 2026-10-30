import { draw, el, enter, motion } from "svjeez";
import { voxel } from "svjeez/voxel";

const eye = voxel.camera({ yaw: 45, pitch: 30, unit: 24 });
const stone = voxel.texture({ s: "#888" }, "s");

export const invalid = [
  // @ts-expect-error <g> cannot draw
  <g animation={draw({ at: 0, over: 1 })} />,
  // @ts-expect-error feTurbulence takes no CSS channels
  <feTurbulence animation={enter({ at: 0, over: 1 })} />,
  // @ts-expect-error feDisplacementMap animates displace, not the CSS scale channel
  <feDisplacementMap animation={motion().to({ scale: 2 }, 1)} />,
  // @ts-expect-error misspelled channel
  motion().to({ opcity: 1 }, 1),
  // @ts-expect-error <g> cannot draw, through el too
  el.g({ animation: draw({ at: 0, over: 1 }) }),
  // @ts-expect-error a block's <use> cannot draw
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: stone, animation: draw({ at: 0, over: 1 }) }] }),
];
