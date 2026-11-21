import {
  Arrow,
  Group,
  Sequence,
  Shape,
  Text,
  circle,
  clock,
  ease,
  ellipse,
  enter,
  exit,
  looping,
  path,
  pattern,
  radial,
  rect,
  ref,
  sampled,
  scene,
  span,
  tokens,
  track,
  type Clock,
  type Ref,
  type SceneElement,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";
import {
  BALANCE,
  FORK,
  PIN,
  PITCH,
  SWING,
  balanceAt,
  forkAt,
  polar,
  wheelAt,
  WHEEL0,
  type P,
} from "../escapement/mechanism";
import {
  BLUED,
  BRASS_EDGE,
  GILT,
  Jewel,
  Pin,
  RUBY,
  RUBY_EDGE,
  STEEL,
  STEEL_EDGE,
  Shade,
  add,
  balanceWheel,
  escapeWheel,
  fork,
  spiral,
} from "./parts";

// The React page inlines this next to other scenes, so it keeps its ids to itself.
export const prefix = "watch-";

const SIZE: Vec = [1000, 600];

// A beat is one swing of the balance, ten times slower than a watch at 28,800 beats an hour.
const BEAT = 1.25;
const SWING_TIME = 2 * BEAT;
const D = 15;
const BEATS = D / BEAT;
const BEAT0 = 0.5;

const material = tokens({
  light: { plate: "#F6F5F2", groove: "#D6D3CC", edge: "#B9B5AC" },
  dark: { plate: "#15171B", groove: "#1C1F24", edge: "#2C3036" },
});

// The mechanism is drawn in the escapement's units, turned a quarter so it reads left to right, and scaled up.
const SCALE = 2.4;
const ORIGIN: Vec = [282, 300];

const placed = ([x, y]: P): Vec => [ORIGIN[0] - SCALE * y, ORIGIN[1] + SCALE * x];

const PIVOT: Vec = [FORK[0], FORK[1]];
const STAFF: Vec = [BALANCE[0], BALANCE[1]];

// The mechanism runs on "tick", which the page loops, pauses and scrubs.
const tick = clock("tick", span(0, D));

const beatAt = (t: number): number => BEAT0 + t / BEAT;
const sine = ease.bezier(0.37, 0, 0.63, 1);
const swing = span(0, SWING_TIME);
const [there, back] = span(0, BEAT).chain(BEAT);

const theta = track(SWING).to(-SWING, there, sine).to(SWING, back, sine).loop(SWING_TIME);

const advance = track(0)
  .to((PITCH / 2) * BEATS, span(0, D), ease.linear)
  .loop(D);

const stepping = sampled(
  (t) => wheelAt(beatAt(t)) - wheelAt(BEAT0) - (PITCH / 2) * (beatAt(t) - BEAT0),
  swing,
  { tolerance: 0.04, precision: 2 },
).loop(SWING_TIME);

const rocking = sampled((t) => forkAt(balanceAt(beatAt(t))), swing, {
  tolerance: 0.04,
  precision: 2,
}).loop(SWING_TIME);

const SLICES = 10;
const COILS = 8.5;

const hairspring = Array.from({ length: SLICES + 1 }, (_, j) => {
  const pad = (SWING / SLICES / 2 / (360 * COILS)) * 1.1;
  const u0 = Math.max(0, (j - 0.5) / SLICES - pad);
  const u1 = Math.min(1, (j + 0.5) / SLICES + pad);
  const radius = (u: number): number => 41 - 32 * u;
  const angle = (u: number): number => 62 + 360 * COILS * u;

  return (
    <Group key={`coil-${j}`} offset={STAFF} origin="at" rotate={theta.map((v) => (v * j) / SLICES)}>
      <Shape
        geometry={path.parse(spiral(radius(u0), radius(u1), angle(u0), angle(u1)))}
        stroke={{ color: BLUED, width: 0.8, cap: "round" }}
      />
    </Group>
  );
});

const Mechanism = (): SceneElement => (
  <Group offset={ORIGIN} rotate={90} scale={SCALE} origin="at">
    <Shade c={[0, 0]} r={60} />
    <Shade c={STAFF} r={88} />
    <Pin c={add(PIVOT, [-8.6, -30])} />
    <Pin c={add(PIVOT, [8.6, -30])} />
    <Sequence clock={tick}>
      <Group hit="escape" offset={[0, 0]} origin="at" rotate={advance}>
        <Group
          offset={[0, 0]}
          origin="at"
          rotate={stepping.map((s) => s + WHEEL0 + wheelAt(BEAT0))}
        >
          <Shape
            geometry={escapeWheel}
            fill={STEEL}
            stroke={{ color: STEEL_EDGE, width: 0.4, join: "round" }}
          />
        </Group>
      </Group>
      <Group hit="balance" offset={STAFF} origin="at" rotate={theta}>
        <Shape geometry={balanceWheel} fill={GILT} stroke={{ color: BRASS_EDGE, width: 0.5 }} />
      </Group>
      {hairspring}
      <Group hit="fork" offset={PIVOT} origin="at" rotate={rocking}>
        <Shape geometry={fork.anchor} stroke={{ color: STEEL_EDGE, width: 9.8, cap: "round" }} />
        <Shape geometry={fork.anchor} stroke={{ color: STEEL, width: 9, cap: "round" }} />
        <Shape
          geometry={fork.lever}
          fill={STEEL}
          stroke={{ color: STEEL_EDGE, width: 0.4, join: "round" }}
        />
        <Shape
          geometry={fork.entry}
          fill={RUBY}
          stroke={{ color: RUBY_EDGE, width: 0.3, join: "round" }}
        />
        <Shape
          geometry={fork.exit}
          fill={RUBY}
          stroke={{ color: RUBY_EDGE, width: 0.3, join: "round" }}
        />
      </Group>
      <Group offset={STAFF} origin="at" rotate={theta}>
        <Shape
          geometry={circle(PIN + 4.5)}
          fill="#B4BCC847"
          stroke={{ color: STEEL, width: 0.6 }}
        />
        <Shape
          geometry={circle(2.2)}
          at={[0, PIN]}
          anchor="center"
          fill={RUBY}
          stroke={{ color: RUBY_EDGE, width: 0.3 }}
        />
      </Group>
    </Sequence>
    <Pin c={add(STAFF, polar(41, 62))} />
    <Jewel c={PIVOT} r={3.4} />
    <Jewel c={[0, 0]} r={3.4} />
    <Jewel c={STAFF} r={5} />
  </Group>
);

// Each part has a clock of its own that brings in its spotlight, ring, label and leader. A state rests it at the
// end of that entrance; the plain SVG plays on through a hold and an exit, so it tours the parts.
const IN = 0.8;
const HOLD = 2;
const OUT = 0.6;
const LENGTH = IN + HOLD + OUT;

/** Where a part's clock rests while the part is in focus. */
export const FOCUSED = IN / LENGTH;

interface Part {
  readonly clock: Clock;
  readonly name: string;
  readonly note: string;
  readonly center: Vec;
  /** The spotlight's radius, and the ring's size around the part. */
  readonly reach: number;
  readonly ring: Vec;
  readonly label: Vec;
  readonly align: "baseline-left" | "baseline-right";
  /** Where the leader starts, beside the label, and where on the ring it ends. */
  readonly from: (label: Ref) => Ref["center"];
  readonly to: (ring: Ref) => Ref["center"];
  /** Arrows that show which way the part moves, as [from, to, bend]. */
  readonly cues: readonly (readonly [Vec, Vec, number])[];
}

const around = (center: Vec, r: number, deg: number): Vec => add(center, polar(r, deg));

const escape: Part = {
  clock: clock("escape", span(1.2, LENGTH)),
  name: "Escape wheel",
  note: "15 teeth · half a tooth a beat",
  center: placed([0, 0]),
  reach: 170,
  ring: [158, 158],
  label: [56, 70],
  align: "baseline-left",
  from: (label) => label.bottomLeft.map(([x, y]) => [x + 30, y + 8]),
  to: (ring) => ring.center.map(([x, y]) => [x - 112, y - 112]),
  cues: [[around(placed([0, 0]), 178, 200), around(placed([0, 0]), 178, 245), -0.12]],
};

const pallet: Part = {
  clock: clock("fork", span(4, LENGTH)),
  name: "Pallet fork",
  note: "rocks 11° between two pins",
  center: placed([0, -96]),
  reach: 150,
  ring: [128, 96],
  label: [512, 552],
  align: "baseline-left",
  from: (label) => label.topLeft.map(([x, y]) => [x - 10, y + 6]),
  to: (ring) => ring.bottom,
  cues: [
    [placed([-14, -112]), placed([-32, -112]), 0],
    [placed([14, -112]), placed([32, -112]), 0],
  ],
};

const wheel: Part = {
  clock: clock("balance", span(6.8, LENGTH)),
  name: "Balance wheel",
  note: "swings 250° each way",
  center: placed(STAFF),
  reach: 240,
  ring: [224, 224],
  label: [960, 62],
  align: "baseline-right",
  from: (label) => label.bottomLeft.map(([x, y]) => [x - 6, y + 4]),
  to: (ring) => ring.center.map(([x, y]) => [x + 158, y - 158]),
  cues: [
    [around(placed(STAFF), 242, 55), around(placed(STAFF), 242, 85), -0.12],
    [around(placed(STAFF), 242, 125), around(placed(STAFF), 242, 95), 0.12],
  ],
};

const Focus = ({ part }: { readonly part: Part }): SceneElement => {
  const [label, ring] = [ref(), ref()];

  const shown = track(0)
    .to(1, span(0, IN), ease.inOut)
    .to(0, span(IN + HOLD, OUT), ease.inOut);

  return (
    <Sequence clock={part.clock}>
      <Shape
        geometry={rect(SIZE[0], SIZE[1])}
        fill={theme.background}
        opacity={shown.map((v) => v * 0.78)}
        mask={
          <Shape
            geometry={rect(SIZE[0], SIZE[1])}
            fill={radial({
              center: part.center,
              radius: part.reach,
              stops: [
                [0, "#00000000"],
                [0.8, "#00000000"],
                [1, "#000000"],
              ],
            })}
          />
        }
      />
      <Shape
        ref={ring}
        geometry={ellipse(part.ring[0], part.ring[1])}
        at={part.center}
        anchor="center"
        stroke={{ color: theme.blue, width: 2 }}
        draw={track(0).to(1, span(0.1, 0.6), ease.inOut)}
        opacity={track(1).to(0, span(IN + HOLD, OUT))}
      />
      <Group motion={[enter(span(0.35, 0.45)), exit(span(IN + HOLD, OUT))]}>
        <Group ref={label}>
          <Text
            font={geist}
            weight={600}
            size={22}
            at={part.label}
            anchor={part.align}
            fill={theme.text}
          >
            {part.name}
          </Text>
          <Text
            font={mono}
            size={13}
            at={add(part.label, [0, 22])}
            anchor={part.align}
            fill={theme.muted}
          >
            {part.note}
          </Text>
        </Group>
      </Group>
      <Arrow
        from={part.from(label)}
        to={part.to(ring)}
        stroke={{ color: theme.blue, width: 1.5 }}
        head={7}
        draw={track(0)
          .to(1, span(0.3, 0.5))
          .to(0, span(IN + HOLD, OUT))}
      />
      {part.cues.map(([from, to, bend], index) => (
        <Arrow
          key={`${part.clock.name}-cue-${index}`}
          from={from}
          to={to}
          bend={bend}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          head={9}
          draw={track(0)
            .to(1, span(0.45, 0.35))
            .to(0, span(IN + HOLD, OUT))}
        />
      ))}
    </Sequence>
  );
};

const STATES = {
  "motion.playing": { tick: looping },
  "motion.paused": {},
  "focus.overview": { escape: 0, fork: 0, balance: 0 },
  "focus.escape": { escape: FOCUSED, fork: 0, balance: 0 },
  "focus.fork": { escape: 0, fork: FOCUSED, balance: 0 },
  "focus.balance": { escape: 0, fork: 0, balance: FOCUSED },
};

export default scene(
  {
    size: SIZE,
    duration: D,
    title: "How a watch escapement keeps time",
    desc: "A Swiss lever escapement running ten times slower than life. The balance wheel swings on its hairspring, its pin throws the pallet fork from one banking pin to the other, and each throw lets the escape wheel advance half a tooth before a ruby stone locks it again. A spotlight visits the escape wheel, the pallet fork and the balance wheel in turn, each with its name and a leader line.",
    theme,
    still: 2.4,
    states: STATES,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={material.plate} />
      <Shape
        geometry={canvas.rect}
        fill={pattern({
          size: [40, 40],
          tile: (
            <Group>
              <Shape
                geometry={circle(17)}
                at={[20, 20]}
                anchor="center"
                stroke={{ color: material.groove, width: 1 }}
              />
              <Shape
                geometry={circle(17)}
                at={[0, 0]}
                anchor="center"
                stroke={{ color: material.groove, width: 1 }}
              />
              <Shape
                geometry={circle(17)}
                at={[40, 0]}
                anchor="center"
                stroke={{ color: material.groove, width: 1 }}
              />
              <Shape
                geometry={circle(17)}
                at={[0, 40]}
                anchor="center"
                stroke={{ color: material.groove, width: 1 }}
              />
              <Shape
                geometry={circle(17)}
                at={[40, 40]}
                anchor="center"
                stroke={{ color: material.groove, width: 1 }}
              />
            </Group>
          ),
        })}
      />
      <Mechanism />
      <Group>
        <Text
          font={geist}
          weight={600}
          size={16}
          at={[56, 540]}
          anchor="baseline-left"
          fill={theme.text}
        >
          Swiss lever escapement
        </Text>
        <Text font={mono} size={12} at={[56, 562]} anchor="baseline-left" fill={theme.muted}>
          28,800 beats an hour, shown 10× slower
        </Text>
      </Group>
      <Focus part={escape} />
      <Focus part={pallet} />
      <Focus part={wheel} />
    </Group>
  ),
);
