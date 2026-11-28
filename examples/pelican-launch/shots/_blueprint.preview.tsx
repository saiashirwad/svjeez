import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { BLUEPRINT, Blueprint } from "./blueprint";

export default scene(
  { size: [W, H], duration: BLUEPRINT, title: "Blueprint shot", loop: false },
  () => (
    <Group>
      <Blueprint />
    </Group>
  ),
);
