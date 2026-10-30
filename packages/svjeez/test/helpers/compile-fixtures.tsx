import { def, ease, motion } from "svjeez";

export const defsTree = () => {
  const unused = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
  const card = def.clipPath({}, <rect width={10} height={10} />);
  const bg = def.linearGradient({ x2: 1 }, <stop offset={0} stopColor="#fff" />);
  void unused;

  return (
    <g clipPath={card}>
      <rect width={10} height={10} fill={bg} />
      <rect width={10} height={10} fill={bg} />
    </g>
  );
};

export const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
export const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
export const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });
export const spin = () => motion().to({ [yaw]: 90 }, 1, ease.linear);

export const boil = () =>
  def.filter(
    {},
    <feTurbulence
      baseFrequency={0.04}
      animation={motion({ seed: 1 }).to({ seed: 5 }, 0.4, ease.steps(4)).loop(0.4)}
    />,
  );
