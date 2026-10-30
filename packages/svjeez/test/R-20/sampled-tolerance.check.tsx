import { def, sampled } from "svjeez";

const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });

export const valid = [
  <circle r={2} animation={sampled((t) => ({ x: t, y: t, opacity: 1 }), { duration: 1, tolerance: { translate: 1, opacity: 0.02 } })} />,
  <circle r={2} animation={sampled((t) => ({ x: t, [px]: t }), { duration: 1, tolerance: { translate: 1, [px]: 0.01 } })} />,
];

export const invalid = [
  // @ts-expect-error scale is sampled but has no tolerance
  sampled((t) => ({ x: t, scale: 1 }), { duration: 1, tolerance: { translate: 1 } }),
  // @ts-expect-error foo is not an animatable channel
  sampled((t) => ({ x: t, foo: 1 }), { duration: 1, tolerance: { translate: 1 } }),
  // @ts-expect-error tolerances are keyed by lane, not channel
  sampled((t) => ({ x: t }), { duration: 1, tolerance: { x: 1 } }),
  // @ts-expect-error py is sampled but has no tolerance
  sampled((t) => ({ [px]: t, [py]: t }), { duration: 1, tolerance: { [px]: 0.01 } }),
  // @ts-expect-error a color property cannot be sampled
  sampled(() => ({ [tint]: "#fff" }), { duration: 1, tolerance: { [tint]: 1 } }),
];
