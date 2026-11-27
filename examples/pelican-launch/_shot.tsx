/** Scratch: render one shot alone while working on it. Not part of the film. */
import { Group, scene } from "svjeez";
import { Blueprint, BLUEPRINT } from "./blueprint";
import { H, W } from "./kit";

export default scene({ size: [W, H], duration: BLUEPRINT, title: "shot", loop: false }, () => (
  <Group>
    <Blueprint />
  </Group>
));
