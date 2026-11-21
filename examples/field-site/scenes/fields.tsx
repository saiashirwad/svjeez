import {
  Arrow,
  Group,
  Sequence,
  Shader,
  Shape,
  Stack,
  Text,
  circle,
  clock,
  count,
  ease,
  line,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { d, std } from "typegpu";
import { BOTTOM, CHARGES, HEIGHT, LEFT, RIGHT, STEP, TOP, UNIT, WIDTH } from "./field";
import { Fallback, Plate, Rulers } from "./frame";
import { COOL, INK, MUTED, TEXT, WARM, mono } from "./style";

// source: begin
/** The page drags each charge and the probe by moving two clocks, x and y, from 0 at one edge to 1 at the other. */
const DRAG = span(0, 0.5);

const [ax, ay, bx, by] = [
  clock("ax", DRAG),
  clock("ay", DRAG),
  clock("bx", DRAG),
  clock("by", DRAG),
];

const [cx, cy, dx, dy] = [
  clock("cx", DRAG),
  clock("cy", DRAG),
  clock("dx", DRAG),
  clock("dy", DRAG),
];

const [px, py] = [clock("px", DRAG), clock("py", DRAG)];

/** What the probe reads, worked out by the page: the field's heading and length, its strength and the potential. */
const [heading, reach] = [clock("heading", DRAG), clock("reach", DRAG)];
const [strength, potential] = [clock("strength", DRAG), clock("potential", DRAG)];

/** Peeling lifts the vector layer off the GPU layer: the "peeled" state runs it to 1. */
const peel = clock("peel", span(0, 0.8));

/** Where progress on an x or y clock puts a thing. The vector tracks and the shader both read it from here. */
const across = (progress: number): number => {
  "use gpu";

  return LEFT + (RIGHT - LEFT) * progress;
};

const down = (progress: number): number => {
  "use gpu";

  return TOP + (BOTTOM - TOP) * progress;
};

type Clock = ReturnType<typeof clock>;

/** A node's x on its x clock, and its y on its y clock, nested inside. */
const slideX = (x: Clock) =>
  track<Vec>([across(0), 0]).to([across(1), 0], span(0, x.over), ease.linear);

const slideY = (y: Clock) =>
  track<Vec>([0, down(0)]).to([0, down(1)], span(0, y.over), ease.linear);

/** One charge's pull at `p`: its field (xy), its potential (z) and its stream function (w), in units of u. */
const pull = (p: d.v2f, x: number, y: number, q: number): d.v4f => {
  "use gpu";
  const r = std.div(std.sub(p, d.vec2f(across(x), down(y))), UNIT);
  const square = std.max(std.dot(r, r), 0.0004);

  return d.vec4f(std.mul(r, q / square), -q * 0.5 * std.log(square), q * std.atan2(r.y, r.x));
};

const TAU = 6.2831853;

/** Field lines leave each unit of charge this many ways. */
const LINES = 6;

const Field = () => (
  <Shader
    name="field"
    width={WIDTH}
    height={HEIGHT}
    inputs={{ ax, ay, bx, by, cx, cy, dx, dy, peel }}
    fragment={(uv, input) => {
      "use gpu";
      const p = std.mul(uv, d.vec2f(WIDTH, HEIGHT));
      const a = pull(p, input.ax, input.ay, 2);
      const b = pull(p, input.bx, input.by, -2);
      const c = pull(p, input.cx, input.cy, 1);
      const f = std.add(std.add(a, b), std.add(c, pull(p, input.dx, input.dy, -1)));
      const e = std.max(std.length(f.xy), 0.0001);

      // Device pixels to a u, so a line is as wide everywhere: a step of potential is 1 / e u across here.
      const scale = (input.resolution.x * UNIT) / WIDTH;

      // Equipotentials: thin rings every STEP of potential, on bands that step a shade at each.
      const ring = (std.abs(std.fract(f.z / STEP + 0.5) - 0.5) * STEP * scale) / e;
      const iso = 1 - std.smoothstep(0.3, 1.3, ring);

      // Field lines are where the stream function crosses a whole step: LINES a charge, more for +2q and -2q.
      const strand =
        (std.abs(std.fract((f.w * LINES) / TAU + 0.5) - 0.5) * (TAU / LINES) * scale) / e;

      const along = 1 - std.smoothstep(0.4, 1.6, strand);

      // Light runs down each field line toward lower potential, as dashes that ride time.
      const dash = std.smoothstep(0.55, 1, std.fract(f.z * 1.2 + input.time * 0.45));

      const side = std.tanh(f.z * 0.4);
      const tint = std.mix(d.vec3f(0.36, 0.78, 1), d.vec3f(1, 0.54, 0.36), std.step(0, side));
      const shelf = std.floor(std.abs(f.z) / STEP) * STEP;
      const depth = std.tanh(shelf * 0.3) * 0.2;
      const ground = std.mix(d.vec3f(0.039, 0.055, 0.078), tint, depth);
      const near = std.smoothstep(0, 1.2, e);

      const lit = std.add(
        std.add(ground, std.mul(tint, iso * (0.12 + 0.2 * std.abs(side)))),
        std.mul(std.mix(d.vec3f(0.7, 0.75, 0.82), tint, 0.5), along * (0.1 + 0.5 * dash * near)),
      );

      // Peeled, the field steps back: grey and dim, so the vector layer stands out.
      const grey = d.vec3f(std.dot(lit, d.vec3f(0.3, 0.59, 0.11)) * 0.6);

      return d.vec4f(std.mix(lit, grey, input.peel * 0.85), 1);
    }}
  >
    <Fallback />
  </Shader>
);

const charge = (q: number) => (q > 0 ? WARM : COOL);
const label = (q: number) => `${q > 0 ? "+" : "−"}${Math.abs(q) === 1 ? "" : Math.abs(q)}q`;

/** A charge: a disc with its sign, and a label on a leader. `hit` is how the page finds it to drag. */
const Charge = ({ name, q, x, y }: { name: string; q: number; x: Clock; y: Clock }) => (
  <Sequence clock={x}>
    <Group offset={slideX(x)}>
      <Sequence clock={y}>
        <Group offset={slideY(y)}>
          <Shape geometry={circle(30)} fill={charge(q)} opacity={0.14} />
          <Shape
            hit={name}
            geometry={circle(17)}
            fill={INK}
            stroke={{ color: charge(q), width: 2 }}
          />
          <Shape
            geometry={line([-7, 0], [7, 0])}
            stroke={{ color: charge(q), width: 2.5, cap: "round" }}
          />
          {q > 0 && (
            <Shape
              geometry={line([0, -7], [0, 7])}
              stroke={{ color: charge(q), width: 2.5, cap: "round" }}
            />
          )}
          <Arrow
            from={[52, -46]}
            to={[0, 0]}
            inset={24}
            head={5}
            stroke={{ color: MUTED, width: 1 }}
          />
          <Text font={mono} size={15} fill={TEXT} at={[58, -46]} anchor={[0, 0.5]}>
            {label(q)}
          </Text>
        </Group>
      </Sequence>
    </Group>
  </Sequence>
);

const AXES = { a: [ax, ay], b: [bx, by], c: [cx, cy], d: [dx, dy] } as const;

/** The readout's numbers: the field's strength on a log scale from 0.01 to 100, the potential from -8 to 8. */
const strong = track(0)
  .to(1, span(0, strength.over), ease.linear)
  .map((progress) => 10 ** (progress * 4 - 2));

const level = track(-8).to(8, span(0, potential.over), ease.linear);
const figures = (value: number) => (value < 10 ? value.toFixed(2) : value.toFixed(1));
const signed = (value: number) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}`;

/**
 * The probe: a ring, the field there as an arrow along a dashed tangent, and a readout of its strength and the
 * potential. The tangent runs as far back as the arrow can reach, so the turning group is centered on the probe.
 */
const Probe = () => (
  <Sequence clock={px}>
    <Group offset={slideX(px)}>
      <Sequence clock={py}>
        <Group offset={slideY(py)}>
          <Sequence clock={heading}>
            <Group rotate={track(-180).to(180, span(0, heading.over), ease.linear)}>
              <Shape
                geometry={line([-150, 0], [150, 0])}
                stroke={{ color: MUTED, width: 1, dash: [3, 5] }}
                opacity={0.7}
              />
              <Sequence clock={reach}>
                <Arrow
                  from={[0, 0]}
                  to={[140, 0]}
                  inset={0}
                  head={10}
                  draw={track(0.12).to(1, span(0, reach.over), ease.linear)}
                  stroke={{ color: TEXT, width: 2, cap: "round" }}
                />
              </Sequence>
            </Group>
          </Sequence>
          <Shape hit="probe" geometry={circle(9)} fill={INK} stroke={{ color: TEXT, width: 1.5 }} />
          <Shape geometry={circle(2)} fill={TEXT} />
          <Group offset={[20, 18]}>
            <Stack
              direction="column"
              gap={4}
              padding={[8, 10]}
              fill="#0A0E14D9"
              stroke={{ color: "#2A3342", width: 1 }}
              radius={3}
            >
              <Sequence clock={strength}>
                <Text font={mono} size={13} fill={TEXT}>
                  {"|E| "}
                  {count(strong, { format: figures, rate: 800 })}
                </Text>
              </Sequence>
              <Sequence clock={potential}>
                <Text font={mono} size={13} fill={MUTED}>
                  {"φ   "}
                  {count(level, { format: signed, rate: 400 })}
                </Text>
              </Sequence>
            </Stack>
          </Group>
        </Group>
      </Sequence>
    </Group>
  </Sequence>
);

const fade = track(0).to(1, span(0.3, 0.5));

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: 1,
    loop: false,
    still: false,
    title: "Fields",
    desc: "Four line charges, +2q, -2q, +q and -q, and the electric field around them: equipotential rings and field lines with light running along them, a probe reading the field, and rulers.",
    states: { flat: { peel: 0 }, peeled: { peel: 1 } },
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={INK} />
      <Sequence clock={peel}>
        <Group offset={track<Vec>([0, 0]).to([26, 26], span(0, peel.over), ease.inOut)}>
          <Field />
          <Plate tag="WebGPU · TypeGPU" at={[1060, 880]} point={[1150, 800]} opacity={fade} />
        </Group>
        <Group offset={track<Vec>([0, 0]).to([-14, -14], span(0, peel.over), ease.inOut)}>
          <Rulers />
          {CHARGES.map(({ name, q }) => (
            <Charge key={name} name={name} q={q} x={AXES[name][0]} y={AXES[name][1]} />
          ))}
          <Probe />
          <Plate tag="SVG · svjeez" at={[200, 120]} point={[150, 52]} opacity={fade} />
        </Group>
      </Sequence>
    </Group>
  ),
);
// source: end
