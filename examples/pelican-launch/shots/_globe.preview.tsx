import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { GLOBE, Globe } from "./globe";

export default scene({ size: [W, H], duration: GLOBE, title: "Globe shot", loop: false }, () => (
  <Group>
    <Globe />
  </Group>
));
