import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { KRAFT, Kraft } from "./kraft";

export default scene({ size: [W, H], duration: KRAFT, title: "Kraft shot", loop: false }, () => (
  <Group>
    <Kraft />
  </Group>
));
