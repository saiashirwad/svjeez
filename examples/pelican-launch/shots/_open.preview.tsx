import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { OPEN, Open } from "./open";

export default scene({ size: [W, H], duration: OPEN, title: "Open shot", loop: false }, () => (
  <Group>
    <Open />
  </Group>
));
