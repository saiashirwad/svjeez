import { def, ease, motion, type SyntaxOf } from "svjeez";

const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });

export const valid = [
  <g animation={motion().to({ [yaw]: 360, opacity: 1 }, 12, ease.linear)}>
    <circle r={2} style={{ [px]: 0.5, [py]: -0.5, [tint]: "#f80" }} />
  </g>,
];

export const syntax: SyntaxOf<typeof yaw> = "angle";

export const invalid = [
  // @ts-expect-error a color into an angle property
  motion().to({ [yaw]: "#fff" }, 1),
  // @ts-expect-error a color into an angle property, set statically
  <g style={{ [yaw]: "#fff" }} />,
  // @ts-expect-error a number into a color property
  <g style={{ [tint]: 1 }} />,
  // @ts-expect-error the initial value must match the syntax
  def.property("bad", { syntax: "angle", inherits: true, initial: "#fff" }),
];
