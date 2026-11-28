import { Group, scene } from "svjeez";
import { H, W } from "../kit";
import { TITLE, Title } from "./title";

export default scene({ size: [W, H], duration: TITLE, title: "Title shot", loop: false }, () => (
  <Group>
    <Title />
  </Group>
));
