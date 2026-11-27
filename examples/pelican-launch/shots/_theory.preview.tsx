import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { THEORY, Theory } from "./theory";

export default scene({ size: [W, H], duration: THEORY, title: "Theory shot", loop: false }, () => (
  <Group>
    <Theory />
  </Group>
));
