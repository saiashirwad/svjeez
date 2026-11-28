/** One pelican on one bicycle, large, for working on the drawing. */
import { Group, Shape, blur, ellipse, scene } from "svjeez";
import { H, W } from "./kit";
import { studio } from "./looks";
import { Pelican } from "./rig";
import { StudioSweep } from "./textures";

const look = studio;

export default scene(
  { size: [W, H], duration: 2, title: "Claude Pelican 1: the pelican", loop: true },
  () => (
    <Group>
      <StudioSweep />
      <Shape
        geometry={ellipse(260, 14)}
        offset={[W / 2 + 30, 642]}
        fill="#2A2520"
        opacity={0.22}
        effects={[blur(10)]}
      />
      <Shape
        geometry={ellipse(70, 4)}
        offset={[W / 2 - 122, 640]}
        fill="#1A1612"
        opacity={0.45}
        effects={[blur(3)]}
      />
      <Shape
        geometry={ellipse(70, 4)}
        offset={[W / 2 + 130, 640]}
        fill="#1A1612"
        opacity={0.45}
        effects={[blur(3)]}
      />
      <Group offset={[W / 2 - 20, 640]} scale={3.5} origin="own">
        <Pelican look={look} />
      </Group>
    </Group>
  ),
);
