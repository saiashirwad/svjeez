import { calc, css, def, type Calc } from "svjeez";

const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });
const radius = def.property("radius", { syntax: "length", inherits: false, initial: 0 });
const { add, sub, mul, div, sin, cos, clamp, max, length, angle } = calc;

export const valid = [
  css`.dot{translate:${add(length(100), mul(length(60), px, cos(yaw)))} ${length(sub(mul(py, sin(yaw)), 1))}}`,
  css`.dot{scale:${div(720, add(720, mul(px, sin(angle(22)))))};opacity:${clamp(0.15, sub(0.95, div(px, 300)), 1)}}`,
];

export const dimensions: [Calc<"number">, Calc<"length">, Calc<"angle">, Calc<"length">] = [
  div(px, max(py, 1)),
  mul(radius, cos(yaw), 2),
  add(yaw, angle(90)),
  clamp(length(0), radius, length(40)),
];

export const invalid = [
  // @ts-expect-error length × length
  mul(length(1), length(2)),
  // @ts-expect-error a length property times a length
  mul(radius, length(2)),
  // @ts-expect-error the dimensioned factor comes first
  mul(2, length(1)),
  // @ts-expect-error length / length is not portable CSS
  div(radius, length(2)),
  // @ts-expect-error cos of a number
  cos(1),
  // @ts-expect-error cos of a number property
  cos(px),
  // @ts-expect-error a length where an angle is needed
  sin(radius),
  // @ts-expect-error a length plus a number
  add(length(1), 2),
  // @ts-expect-error a number plus an angle property
  add(1, yaw),
  // @ts-expect-error clamp keeps one dimension
  clamp(length(0), 0.5, length(1)),
  // @ts-expect-error a color property has no arithmetic
  add(tint, 1),
  // @ts-expect-error length() takes a number, not a length
  length(radius),
];
