import { voxel, type VoxelBlock, type Vec3 } from "@svjeez/voxel";
import { render } from "svjeez";

const camera = voxel.camera({ yaw: 45, pitch: 30, unit: 12 });
const stone = voxel.texture({ s: "#888888" }, "s");
const at: Vec3 = [0, 0, 0];
const blocks: VoxelBlock[] = [{ at, skin: stone }];

export const svg: string = render(
  { width: 200, height: 200, duration: 2, title: "Voxel" },
  voxel.scene({ camera, blocks }),
);
