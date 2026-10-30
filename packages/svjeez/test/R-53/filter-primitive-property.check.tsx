import { def, motion } from "svjeez";

const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });

export const invalid = [
  // @ts-expect-error filter primitives animate through SMIL, which cannot reach a property
  <feFlood animation={motion().to({ [yaw]: 1 }, 1)} />,
];
