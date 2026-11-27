import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { POTTERY, Pottery } from "./pottery";

export default scene(
  { size: [W, H], duration: POTTERY, title: "Pottery shot", loop: false },
  () => (
    <Group>
      <Pottery />
    </Group>
  ),
);
