/** @jsxImportSource svjeez/scene */
import { defaults, number, text, type Values } from "svjeez/params";
import { Shape, circle, scene } from "svjeez/scene";

export const params = {
  title: text("Dot", { maxLength: 12 }),
  radius: number(10, { min: 1, max: 30, step: 1 }),
};

export default (p: Values<typeof params> = defaults(params)) =>
  scene({ size: [100, 60], duration: 2, title: p.title }, () => (
    <Shape geometry={circle(p.radius)} at={[50, 30]} anchor="center" fill="#3EE6D6" />
  ));
