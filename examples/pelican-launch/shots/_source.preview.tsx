import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { SOURCE, Source } from "./source";

export default scene({ size: [W, H], duration: SOURCE, title: "Source shot", loop: false }, () => (
  <Group>
    <Source />
  </Group>
));
