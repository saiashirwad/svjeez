import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { LACE, Lace } from "./lace";

export default scene({ size: [W, H], duration: LACE, title: "Lace shot", loop: false }, () => (
  <Group>
    <Lace />
  </Group>
));
