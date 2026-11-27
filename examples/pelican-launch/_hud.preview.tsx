import { Group, Shape, rect, scene } from "svjeez";
import { H, W } from "./kit";
import { Odometer } from "./hud";

const LENGTH = 20;

export default scene({ size: [W, H], duration: LENGTH, title: "Odometer HUD", loop: false }, () => (
  <Group>
    <Shape geometry={rect(1130, H)} fill="#0E0E0D" />
    <Shape geometry={rect(W - 1130, H)} at={[1130, 0]} fill="#F3EFE4" />
    <Odometer length={LENGTH} />
  </Group>
));
