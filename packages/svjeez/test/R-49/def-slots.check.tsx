import { def } from "svjeez";

const bg = def.linearGradient({}, <stop offset={0} stopColor="#000" />);

export const invalid = [
  // @ts-expect-error a string url() where a ref is required
  <rect fill="url(#bg)" />,
  // @ts-expect-error a gradient ref is not a clip path
  <g clipPath={bg} />,
];
