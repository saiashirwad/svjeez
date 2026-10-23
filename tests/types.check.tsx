// Compile-time contract, checked by `bun run typecheck`. Each @ts-expect-error must fail for the reason named.
import { css, def, draw, ease, el, enter, fx, motion, sampled, wiggle, type SyntaxOf } from "svg-motion";

const bg = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
const glow = fx.glow();
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });

export const valid = [
  <rect fill={bg} filter={glow} animation={[enter({ at: 0, over: 1 }), draw({ at: 1, over: 1 })]} />,
  <feTurbulence animation={motion({ seed: 1 }).to({ seed: 4 }, 0.4, ease.steps(3)).loop(0.4)} />,
  <text data-role="caption" aria-hidden="true" class={["mono", false]} style={{ letterSpacing: 2 }} animation={wiggle({ x: 1 }, { seed: 1 })} />,
  el.rect({ x: 12, y: 34, fill: bg, filter: glow, animation: enter({ at: 0, over: 1 }) }),
  el.g({ opacity: 0.5 }, [el.circle({ r: 2 }), "hi"]),
  el.text({ x: 4 }, "hi"),
  <circle r={2} animation={sampled((t) => ({ x: t, y: t, opacity: 1 }), { duration: 1, tolerance: { translate: 1, opacity: 0.02 } })} />,
  <g animation={motion().to({ [yaw]: 360, opacity: 1 }, 12, ease.linear)}>
    <circle r={2} style={{ [px]: 0.5, [py]: -0.5, [tint]: "#f80" }} />
  </g>,
  css`.dot{translate:calc(${px} * cos(${yaw}) * ${60}px) 0}`,
];

export const syntax: SyntaxOf<typeof yaw> = "angle";

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
  // @ts-expect-error feDisplacementMap animates displace, not the CSS scale channel
  <feDisplacementMap animation={motion().to({ scale: 2 }, 1)} />,
  // @ts-expect-error misspelled channel
  motion().to({ opcity: 1 }, 1),
  // @ts-expect-error misspelled attribute through el
  el.path({ strokeLineCap: "round" }),
  // @ts-expect-error <g> cannot draw, through el too
  el.g({ animation: draw({ at: 0, over: 1 }) }),
  // @ts-expect-error wiggle needs a seed
  wiggle({ x: 2 }, { rate: 8 }),
  // @ts-expect-error scale is sampled but has no tolerance
  sampled((t) => ({ x: t, scale: 1 }), { duration: 1, tolerance: { translate: 1 } }),
  // @ts-expect-error foo is not an animatable channel
  sampled((t) => ({ x: t, foo: 1 }), { duration: 1, tolerance: { translate: 1 } }),
  // @ts-expect-error tolerances are keyed by lane, not channel
  sampled((t) => ({ x: t }), { duration: 1, tolerance: { x: 1 } }),
  // @ts-expect-error a color into an angle property
  motion().to({ [yaw]: "#fff" }, 1),
  // @ts-expect-error a color into an angle property, set statically
  <g style={{ [yaw]: "#fff" }} />,
  // @ts-expect-error a number into a color property
  <g style={{ [tint]: 1 }} />,
  // @ts-expect-error filter primitives animate through SMIL, which cannot reach a property
  <feFlood animation={motion().to({ [yaw]: 1 }, 1)} />,
  // @ts-expect-error the initial value must match the syntax
  def.property("bad", { syntax: "angle", inherits: true, initial: "#fff" }),
  // @ts-expect-error a css hole takes a property, a number, or css, not a string
  css`.dot{fill:${"red"}}`,
];
