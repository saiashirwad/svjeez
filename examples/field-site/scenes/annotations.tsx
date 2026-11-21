import { Tex } from "@svjeez/math";
import {
  Arrow,
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  clock,
  count,
  ease,
  enter,
  line,
  polygon,
  rect,
  shadow,
  span,
  track,
  type Child,
  type Span,
  type Color,
  type Vec,
} from "svjeez";
import { CHARGES, FARTHEST, LONGEST, STEP } from "./field";
import { COOL, MUTED, TEXT, WARM, mono } from "./style";

type Clock = ReturnType<typeof clock>;

/** Every page-driven clock but the intro runs over this span, as the drag clocks do. */
const DRAG = span(0, 0.5);

/** The vector layer draws itself in once on this clock, which the page plays when the scene mounts. */
export const intro = clock("intro", span(0, 1.2));

/** Fades its children in on the intro, during `when`. */
export const Reveal = ({ when, children }: { readonly when: Span; readonly children: Child }) => (
  <Sequence clock={intro}>
    <Group motion={enter(when, { from: { opacity: 0 } })}>{children}</Group>
  </Sequence>
);

const sign = (q: number): Color => (q > 0 ? WARM : COOL);

/** A turn of -180° to 180° over a clock. */
const turning = (c: Clock) => track(-180).to(180, span(0, c.over), ease.linear);

/** 0 to 1 over a clock. */
const share = (c: Clock) => track(0).to(1, span(0, c.over), ease.linear);

/** Each charge's push at the probe, as its heading, its heading turned from the one before (for tip to tail), and its length. */
const PARTS = CHARGES.map(({ name, q }) => ({
  name,
  q,
  angle: clock(`${name}angle`, DRAG),
  turn: clock(`${name}turn`, DRAG),
  length: clock(`${name}length`, DRAG),
}));

type Part = (typeof PARTS)[number];

/** The parts tip to tail, as faint dashes: each one turns from the last and starts where the last ends, so the chain ends at the total. */
const Chain = ({ parts }: { parts: readonly Part[] }) => {
  const [first, ...rest] = parts;

  if (!first) return <Group />;

  return (
    <Sequence clock={first.turn}>
      <Group rotate={turning(first.turn)} origin="at">
        <Sequence clock={first.length}>
          <Group>
            <Shape
              geometry={line([0, 0], [LONGEST, 0])}
              stroke={{ color: sign(first.q), width: 1, dash: [3, 3] }}
              draw={share(first.length)}
              opacity={0.7}
            />
            <Group
              offset={track<Vec>([0, 0]).to([LONGEST, 0], span(0, first.length.over), ease.linear)}
            >
              <Chain parts={rest} />
            </Group>
          </Group>
        </Sequence>
      </Group>
    </Sequence>
  );
};

/**
 * Superposition at the probe: a thin arrow for each charge's push, warm or cool by its sign, and the same pushes tip to
 * tail, dashed, ending where the total arrow does.
 */
export const Superposition = () => (
  <Group>
    <Chain parts={PARTS} />
    {PARTS.map(({ name, q, angle, length }) => (
      <Sequence key={name} clock={angle}>
        <Group rotate={turning(angle)} origin="at">
          <Sequence clock={length}>
            <Arrow
              from={[0, 0]}
              to={[LONGEST, 0]}
              inset={0}
              head={6}
              draw={share(length)}
              stroke={{ color: sign(q), width: 1.25, cap: "round" }}
              opacity={0.85}
            />
          </Sequence>
        </Group>
      </Sequence>
    ))}
  </Group>
);

/** The nearest charge: its heading from the probe, that heading turned back (to keep the label upright), and its distance. */
const [bearing, upright, gap] = [
  clock("bearing", DRAG),
  clock("upright", DRAG),
  clock("gap", DRAG),
];

/** How far the dimension line sits off the line between the probe and the charge, and its ticks. */
const ASIDE = -28;
const hair = { color: MUTED, width: 1 } as const;

/** A dimension line from the probe to the nearest charge, set off to one side, with its length in u. */
export const Distance = () => (
  <Group>
    <Sequence clock={bearing}>
      <Group rotate={turning(bearing)} origin="at">
        <Shape geometry={line([0, -12], [0, ASIDE - 5])} stroke={hair} opacity={0.8} />
        <Shape geometry={line([-4, ASIDE + 4], [4, ASIDE - 4])} stroke={hair} />
        <Sequence clock={gap}>
          <Group>
            <Shape
              geometry={line([0, ASIDE], [FARTHEST, ASIDE])}
              stroke={hair}
              draw={share(gap)}
              opacity={0.8}
            />
            <Group offset={track<Vec>([0, 0]).to([FARTHEST, 0], span(0, gap.over), ease.linear)}>
              <Shape geometry={line([0, -22], [0, ASIDE - 5])} stroke={hair} opacity={0.8} />
              <Shape geometry={line([-4, ASIDE + 4], [4, ASIDE - 4])} stroke={hair} />
            </Group>
            <Group
              offset={track<Vec>([0, ASIDE - 11]).to(
                [FARTHEST / 2, ASIDE - 11],
                span(0, gap.over),
                ease.linear,
              )}
            >
              <Sequence clock={upright}>
                <Group rotate={turning(upright)} origin="at">
                  <Sequence clock={gap}>
                    <Text font={mono} size={11} fill={MUTED} at={[0, 0]} anchor="center">
                      {count(track(0).to(FARTHEST / 100, span(0, gap.over), ease.linear), {
                        format: (u) => `${u.toFixed(1)} u`,
                        rate: 400,
                      })}
                    </Text>
                  </Sequence>
                </Group>
              </Sequence>
            </Group>
          </Group>
        </Sequence>
      </Group>
    </Sequence>
  </Group>
);

const E = String.raw`\mathbf{E}(\mathbf{r}) = \sum_i q_i\,\frac{\mathbf{r}-\mathbf{r}_i}{|\mathbf{r}-\mathbf{r}_i|^2}`;
const PHI = String.raw`\varphi(\mathbf{r}) = -\sum_i q_i \ln|\mathbf{r}-\mathbf{r}_i|`;
const UNITS = String.raw`\text{where } 2\pi\varepsilon_0 = 1,\ r \text{ in u}`;

/** A soft dark halo behind the glyphs, so the sums read over the field lines. */
const HALO = [shadow({ color: "#0A0E14", blur: 6 })];

/** The sums the field follows, as `sample()` and the shader work them: set on the figure, below the rulers' numbers. */
export const Equations = () => (
  <Reveal when={span(0.5, 0.5)}>
    <Group offset={[72, 76]} effects={HALO}>
      <Stack direction="column" gap={18} align="start">
        <Tex size={32} fill={TEXT}>
          {E}
        </Tex>
        <Tex size={32} fill={TEXT}>
          {PHI}
        </Tex>
        <Tex size={18} fill={MUTED}>
          {UNITS}
        </Tex>
      </Stack>
    </Group>
  </Reveal>
);

/** The shader's colors, worked the same way: the ground, tinted warm or cool a shade more each band of potential. */
const GROUND = [0.039, 0.055, 0.078] as const;
const WARM_TINT = [1, 0.54, 0.36] as const;
const COOL_TINT = [0.36, 0.78, 1] as const;

const hex = (rgb: readonly number[]): Color => {
  const digits = rgb
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();

  // SAFETY: six hex digits after a #, which is what Color names.
  return `#${digits}` as Color;
};

const band = (phi: number): Color => {
  const tint = phi >= 0 ? WARM_TINT : COOL_TINT;
  // The shader tints at most 0.2 of the way; the legend goes three times as far so a slim bar still reads.
  const depth = Math.tanh(Math.floor(Math.abs(phi) / STEP) * STEP * 0.3) * 0.6;

  return hex(GROUND.map((ground, index) => ground + (tint[index]! - ground) * depth));
};

/** The potential the legend spans, and where it stands on the canvas. */
const REACH = 8;
const LEGEND = { x: 1548, top: 300, bottom: 700, width: 8 } as const;
const PER = (LEGEND.bottom - LEGEND.top) / (2 * REACH);
const height = (phi: number) => LEGEND.top + (REACH - phi) * PER;
const SHELVES = Array.from({ length: (2 * REACH) / STEP }, (_, index) => -REACH + index * STEP);
const LABELS = [-8, -4, 0, 4, 8];

/** A slim scale of potential in the shader's colors, with a marker at the probe's φ. */
export const Legend = ({ potential }: { potential: Clock }) => (
  <Reveal when={span(0.6, 0.5)}>
    <Group>
      {SHELVES.map((phi) => (
        <Shape
          key={`shelf-${phi}`}
          geometry={rect(LEGEND.width, PER * STEP)}
          at={[LEGEND.x, height(phi + STEP)]}
          fill={band(phi)}
        />
      ))}
      {LABELS.map((phi) => (
        <Group key={`tick-${phi}`}>
          <Shape
            geometry={line([LEGEND.x - 3, height(phi)], [LEGEND.x + LEGEND.width, height(phi)])}
            stroke={{ color: phi === 0 ? MUTED : sign(phi), width: 1 }}
          />
          <Text
            font={mono}
            size={10}
            fill={MUTED}
            at={[LEGEND.x - 7, height(phi)]}
            anchor={[1, 0.5]}
          >
            {phi === 0 ? "0" : `${phi < 0 ? "−" : "+"}${Math.abs(phi)}`}
          </Text>
        </Group>
      ))}
      <Shape
        geometry={rect(LEGEND.width, LEGEND.bottom - LEGEND.top)}
        at={[LEGEND.x, LEGEND.top]}
        stroke={{ color: "#3A4556", width: 1 }}
      />
      <Text
        font={mono}
        size={12}
        fill={TEXT}
        at={[LEGEND.x + LEGEND.width / 2, LEGEND.top - 16]}
        anchor="center"
      >
        φ
      </Text>
      <Sequence clock={potential}>
        <Group
          offset={track<Vec>([LEGEND.x + LEGEND.width + 2, LEGEND.bottom]).to(
            [LEGEND.x + LEGEND.width + 2, LEGEND.top],
            span(0, potential.over),
            ease.linear,
          )}
        >
          <Shape geometry={polygon([0, 0], [7, -4.5], [7, 4.5])} fill={TEXT} />
          <Shape
            geometry={line([-LEGEND.width - 2, 0], [0, 0])}
            stroke={{ color: TEXT, width: 1.5 }}
          />
        </Group>
      </Sequence>
    </Group>
  </Reveal>
);
