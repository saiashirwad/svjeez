import { Shape, circle, param, scene } from "svjeez";
import { defaults, type Values } from "svjeez/tools";

export const params = {
  title: param.text("Dot", { maxLength: 12 }),
  radius: param.number(10, { min: 1, max: 30, step: 1 }),
};

export default (p: Values<typeof params> = defaults(params)) =>
  scene({ size: [100, 60], duration: 2, title: p.title }, () => (
    <Shape geometry={circle(p.radius)} at={[50, 30]} anchor="center" fill="#3EE6D6" />
  ));
