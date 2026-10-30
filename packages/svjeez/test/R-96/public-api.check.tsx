import { def, draw, ease, el, enter, fx, motion, wiggle } from "svjeez";

const bg = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
const glow = fx.glow();

export const valid = [
  <rect fill={bg} filter={glow} animation={[enter({ at: 0, over: 1 }), draw({ at: 1, over: 1 })]} />,
  <feTurbulence animation={motion({ seed: 1 }).to({ seed: 4 }, 0.4, ease.steps(3)).loop(0.4)} />,
  <text data-role="caption" aria-hidden="true" class={["mono", false]} style={{ letterSpacing: 2 }} animation={wiggle({ x: 1 }, { seed: 1 })} />,
  el.rect({ x: 12, y: 34, fill: bg, filter: glow, animation: enter({ at: 0, over: 1 }) }),
  el.g({ opacity: 0.5 }, [el.circle({ r: 2 }), "hi"]),
  el.text({ x: 4 }, "hi"),
];
