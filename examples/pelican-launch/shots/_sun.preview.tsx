import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { SUN, Sun } from "./sun";

export default scene({ size: [W, H], duration: SUN, title: "Sun shot", loop: false }, () => (
  <Group>
    <Sun />
  </Group>
));
