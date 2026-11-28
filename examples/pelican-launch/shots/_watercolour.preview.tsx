import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { WATERCOLOUR, Watercolour } from "./watercolour";

export default scene(
  { size: [W, H], duration: WATERCOLOUR, title: "Watercolour shot", loop: false },
  () => (
    <Group>
      <Watercolour />
    </Group>
  ),
);
