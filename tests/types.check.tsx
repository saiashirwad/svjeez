// Compile-time contract, checked by `bun run typecheck`. Each @ts-expect-error must fail for the reason named.
import { def, draw, ease, enter, fx, motion, wiggle } from "svg-motion";

const bg = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
const glow = fx.glow();

export const valid = [
  <rect fill={bg} filter={glow} animation={[enter({ at: 0, over: 1 }), draw({ at: 1, over: 1 })]} />,
  <feTurbulence animation={motion({ seed: 1 }).to({ seed: 4 }, 0.4, ease.steps(3)).loop(0.4)} />,
  <text data-role="caption" aria-hidden="true" class={["mono", false]} style={{ letterSpacing: 2 }} animation={wiggle({ x: 1 }, { seed: 1 })} />,
];

export const invalid = [
  // @ts-expect-error misspelled attribute
  <path strokeLineCap="round" />,
  // @ts-expect-error a string url() where a ref is required
  <rect fill="url(#bg)" />,
  // @ts-expect-error a gradient ref is not a clip path
  <g clipPath={bg} />,
  // @ts-expect-error <g> cannot draw
  <g animation={draw({ at: 0, over: 1 })} />,
  // @ts-expect-error feTurbulence takes no CSS channels
  <feTurbulence animation={enter({ at: 0, over: 1 })} />,
  // @ts-expect-error misspelled channel
  motion().to({ opcity: 1 }, 1),
  // @ts-expect-error wiggle needs a seed
  wiggle({ x: 2 }, { rate: 8 }),
];
