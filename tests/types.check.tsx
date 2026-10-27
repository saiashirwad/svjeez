import { calc, css, def, draw, ease, el, enter, fx, motion, sampled, voxel, wiggle, type Calc, type SyntaxOf } from "svjeez";
import { flowchart, lanes, sequence, state, tree } from "svjeez/extras";

const bg = def.linearGradient({}, <stop offset={0} stopColor="#000" />);
const glow = fx.glow();
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const tint = def.property("tint", { syntax: "color", inherits: false, initial: "#000" });
const radius = def.property("radius", { syntax: "length", inherits: false, initial: 0 });
const eye = voxel.camera({ yaw: 45, pitch: 30, unit: 24 });
const stone = voxel.texture({ s: "#888" }, "s");
const { add, sub, mul, div, sin, cos, clamp, max, length, angle } = calc;

export const valid = [
  <rect fill={bg} filter={glow} animation={[enter({ at: 0, over: 1 }), draw({ at: 1, over: 1 })]} />,
  <feTurbulence animation={motion({ seed: 1 }).to({ seed: 4 }, 0.4, ease.steps(3)).loop(0.4)} />,
  <text data-role="caption" aria-hidden="true" class={["mono", false]} style={{ letterSpacing: 2 }} animation={wiggle({ x: 1 }, { seed: 1 })} />,
  el.rect({ x: 12, y: 34, fill: bg, filter: glow, animation: enter({ at: 0, over: 1 }) }),
  el.g({ opacity: 0.5 }, [el.circle({ r: 2 }), "hi"]),
  el.text({ x: 4 }, "hi"),
  <circle r={2} animation={sampled((t) => ({ x: t, y: t, opacity: 1 }), { duration: 1, tolerance: { translate: 1, opacity: 0.02 } })} />,
  <circle r={2} animation={sampled((t) => ({ x: t, [px]: t }), { duration: 1, tolerance: { translate: 1, [px]: 0.01 } })} />,
  <g animation={motion().to({ [yaw]: 360, opacity: 1 }, 12, ease.linear)}>
    <circle r={2} style={{ [px]: 0.5, [py]: -0.5, [tint]: "#f80" }} />
  </g>,
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: { side: stone, top: stone }, from: 1, animation: enter({ at: 1, over: 1 }, { y: -8 }) }] }),
  motion(eye.project([1, 2, 3])).to(eye.project([4, 0, 1]), 1),
  css`.dot{translate:calc(${px} * cos(${yaw}) * ${60}px) 0}`,
  css`.dot{translate:${add(length(100), mul(length(60), px, cos(yaw)))} ${length(sub(mul(py, sin(yaw)), 1))}}`,
  css`.dot{scale:${div(720, add(720, mul(px, sin(angle(22)))))};opacity:${clamp(0.15, sub(0.95, div(px, 300)), 1)}}`,
];

export const dimensions: [Calc<"number">, Calc<"length">, Calc<"angle">, Calc<"length">] = [
  div(px, max(py, 1)),
  mul(radius, cos(yaw), 2),
  add(yaw, angle(90)),
  clamp(length(0), radius, length(40)),
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
  // @ts-expect-error py is sampled but has no tolerance
  sampled((t) => ({ [px]: t, [py]: t }), { duration: 1, tolerance: { [px]: 0.01 } }),
  // @ts-expect-error a color property cannot be sampled
  sampled(() => ({ [tint]: "#fff" }), { duration: 1, tolerance: { [tint]: 1 } }),
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
  // @ts-expect-error a block sits on three coordinates
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0], skin: stone }] }),
  // @ts-expect-error a skin that names faces still needs a side to fall back on
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: { top: stone } }] }),
  // @ts-expect-error a block's <use> cannot draw
  voxel.scene({ camera: eye, blocks: [{ at: [0, 0, 0], skin: stone, animation: draw({ at: 0, over: 1 }) }] }),
  // @ts-expect-error a texture palette takes hex colors, which it can shade
  voxel.texture({ s: "gray" }, "s"),
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

const machine = state({
  states: { idle: "Idle", busy: { label: "Busy", states: { plan: "Plan", act: "Act" }, initial: "plan" } },
  initial: "idle",
  transitions: [["idle", "busy"], ["plan", "act"]],
});
const chart = flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "b"]] });

export const diagrams = [
  machine.walk(["idle", "busy", "plan", "act"], { at: 0 }),
  chart.route("a", "b"),
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "root" } } }),
  lanes({ lanes: { a: "A" }, spans: [{ lane: "a", from: 0, to: 1 }] }, { scale: 10 }),
];

export const badDiagrams = [
  // @ts-expect-error an edge to a node that does not exist
  flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "c"]] }),
  // @ts-expect-error a group member that does not exist
  flowchart({ nodes: { a: "A" }, groups: { g: { label: "G", nodes: ["b"] } }, edges: [] }),
  // @ts-expect-error a misspelled id, through route
  chart.route("a", "c"),
  // @ts-expect-error a message from an actor that does not exist
  sequence({ actors: { user: "User", api: "API" }, messages: [["usr", "api", "hi"]] }),
  // @ts-expect-error a note on an actor that does not exist
  sequence({ actors: { user: "User" }, messages: [{ note: "db", text: "hi" }] }),
  // @ts-expect-error a transition to a state that does not exist
  state({ states: { a: "A", b: "B" }, initial: "a", transitions: [["a", "c"]] }),
  // @ts-expect-error an initial state that does not exist
  state({ states: { a: "A" }, initial: "b", transitions: [] }),
  // @ts-expect-error a composite whose initial is not one of its own states
  state({ states: { a: { label: "A", states: { x: "X" }, initial: "y" } }, initial: "a", transitions: [] }),
  // @ts-expect-error a walk through a state that does not exist
  machine.walk(["idle", "bsy"], { at: 0 }),
  // @ts-expect-error a parent that does not exist
  tree({ nodes: { root: "Root", kid: { label: "Kid", parent: "rot" } } }),
  // @ts-expect-error a span on a lane that does not exist
  lanes({ lanes: { a: "A" }, spans: [{ lane: "b", from: 0, to: 1 }] }, { scale: 10 }),
  // @ts-expect-error a link to a lane that does not exist
  lanes({ lanes: { a: "A" }, links: [{ from: "a", to: "b", at: 1 }] }, { scale: 10 }),
];
