import { css, def } from "svjeez";

const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });

export const valid = [css`.dot{translate:calc(${px} * cos(${yaw}) * ${60}px) 0}`];

export const invalid = [
  // @ts-expect-error a css hole takes a property, a number, or css, not a string
  css`.dot{fill:${"red"}}`,
];
