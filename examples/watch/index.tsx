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
  type Child,
  type Clock,
  type Ref,
  type Track,
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

// The camera. The "lens" clock zooms in on the plate's middle; each part has a clock that pans the zoomed mechanism
// to it, then brings in its spotlight, ring, label and leader. Pans add, so going from one part to another slides the
// plate across at one zoom. Every clock lasts the whole scene, so the "tick" clock nests inside the camera and the
// mechanism runs on while it moves. A state rests each clock before its move or after it; the plain SVG plays them all
// through, so the camera tours the parts in turn and pulls back out.
const MOVE = 1.3;
const SETTLE = 1.4;
const STAY = 3.8;
const FADE = 0.45;

interface Part {
  readonly clock: Clock;
  readonly name: string;
  readonly note: string;
  /** Where the part is in the overview, and where the camera puts it at `zoom` times the size. */
  readonly center: Vec;
  readonly zoom: number;
  readonly target: Vec;
  /** The spotlight's radius, and the ring's size around the part, as the camera shows them. */
  readonly reach: number;
  readonly ring: Vec;
  readonly label: Vec;
  readonly align: "baseline-left" | "baseline-right";
  /** Where the leader starts, beside the label, and where on the ring it ends. */
  readonly from: (label: Ref) => Ref["center"];
  readonly to: (ring: Ref) => Ref["center"];
  /** Arrows that show which way the part moves, as [from, to, bend], in the overview's coordinates. */
  readonly cues: readonly (readonly [Vec, Vec, number])[];
}

const around = (center: Vec, r: number, deg: number): Vec => add(center, polar(r, deg));

/** Where a point of the overview is once the camera has arrived at a part. */
const seen = (part: Part, [x, y]: Vec): Vec => [
  part.target[0] + part.zoom * (x - part.center[0]),
  part.target[1] + part.zoom * (y - part.center[1]),
];

const escape: Part = {
  clock: clock("escape", span(0, D)),
  name: "Escape wheel",
  note: "15 teeth · half a tooth a beat",
  center: placed([0, 0]),
  zoom: 1.75,
  target: [630, 300],
  reach: 300,
  ring: [272, 272],
  label: [64, 92],
  align: "baseline-left",
  from: (label) => label.right.map(([x, y]) => [x + 16, y]),
  to: (ring) => ring.center.map(([x, y]) => [x - 194, y - 194]),
  cues: [[around(placed([0, 0]), 160, 200), around(placed([0, 0]), 160, 240), -0.12]],
};

const pallet: Part = {
  clock: clock("fork", span(0, D)),
  name: "Pallet fork",
  note: "rocks 11° between two pins",
  center: placed([0, -96]),
  zoom: 2.2,
  target: [610, 290],
  reach: 340,
  ring: [300, 220],
  label: [64, 556],
  align: "baseline-left",
  from: (label) => label.right.map(([x, y]) => [x + 16, y]),
  to: (ring) => ring.center.map(([x, y]) => [x - 300 * 0.35, y + 220 * 0.94]),
  cues: [
    [placed([-14, -112]), placed([-32, -112]), 0],
    [placed([14, -112]), placed([32, -112]), 0],
  ],
};

const wheel: Part = {
  clock: clock("balance", span(0, D)),
  name: "Balance wheel",
  note: "swings 250° each way",
  center: placed(STAFF),
  zoom: 1.45,
  target: [620, 300],
  reach: 330,
  ring: [318, 318],
  label: [64, 92],
  align: "baseline-left",
  from: (label) => label.right.map(([x, y]) => [x + 16, y]),
  to: (ring) => ring.center.map(([x, y]) => [x - 225, y - 225]),
  cues: [
    [around(placed(STAFF), 242, 55), around(placed(STAFF), 242, 85), -0.12],
    [around(placed(STAFF), 242, 125), around(placed(STAFF), 242, 95), 0.12],
  ],
};

// The tour: each part's camera moves in at its time and back out STAY seconds later, as the next one moves in.
const TOUR = [
  [escape, 0.8],
  [pallet, 0.8 + STAY],
  [wheel, 0.8 + 2 * STAY],
] as const;

const PARTS = TOUR.map(([part]) => part);

const timeOf = (part: Part): number => TOUR.find(([each]) => each === part)![1];

const smooth = ease.bezier(0.65, 0, 0.35, 1);

const MIDDLE: Vec = [SIZE[0] / 2, SIZE[1] / 2];
const ZOOM = 1.75;
const LENS_IN = TOUR[0][1];
const LENS_OUT = TOUR[2][1] + STAY;

const lens = clock("lens", span(0, D));

/** Scales what it holds around the middle of the scene, as a track of `scale` says. */
const Zoom = ({
  scale,
  children,
}: {
  readonly scale: Track<number>;
  readonly children: Child;
}): SceneElement => (
  <Group offset={MIDDLE} scale={scale} origin="at">
    <Group offset={[-MIDDLE[0], -MIDDLE[1]]}>{children}</Group>
  </Group>
);

/** Zooms what it holds in on the middle, and back out, on the lens clock. */
const Lens = ({ children }: { readonly children: Child }): SceneElement => (
  <Sequence clock={lens}>
    <Zoom
      scale={track(1).to(ZOOM, span(LENS_IN, MOVE), smooth).to(1, span(LENS_OUT, MOVE), smooth)}
    >
      {children}
    </Zoom>
  </Sequence>
);

/** Pans what the lens holds to a part, scaling it by what the part needs on top of the lens, on the part's clock. */
const Camera = ({
  part,
  children,
}: {
  readonly part: Part;
  readonly children: Child;
}): SceneElement => {
  const [there, back] = [span(timeOf(part), MOVE), span(timeOf(part) + STAY, MOVE)];
  const extra = part.zoom / ZOOM;

  // Inside the lens and the part's own scale, the pan that brings the part's center to its target.
  const along = (i: 0 | 1): number =>
    (part.target[i] - MIDDLE[i]) / part.zoom + MIDDLE[i] - part.center[i];

  const pan: Vec = [along(0), along(1)];

  return (
    <Sequence clock={part.clock}>
      <Zoom scale={track(1).to(extra, there, smooth).to(1, back, smooth)}>
        <Group offset={track<Vec>([0, 0]).to(pan, there, smooth).to([0, 0], back, smooth)}>
          {children}
        </Group>
      </Zoom>
    </Sequence>
  );
};

/** Hides what it holds while the camera is on a part: it fades fast on the way in and comes back late on the way out. */
const Overview = ({
  part,
  children,
}: {
  readonly part: Part;
  readonly children: Child;
}): SceneElement => (
  <Sequence clock={part.clock}>
    <Group
      opacity={track(1)
        .to(0, span(timeOf(part), 0.3), ease.inOut)
        .to(1, span(timeOf(part) + STAY + MOVE - 0.3, 0.3), ease.inOut)}
    >
      {children}
    </Group>
  </Sequence>
);

const Focus = ({ part }: { readonly part: Part }): SceneElement => {
  const [label, ring] = [ref(), ref()];
  const at = timeOf(part);
  const out = span(at + STAY - FADE, FADE);

  const shown = track(0)
    .to(1, span(at + 0.3, MOVE), ease.inOut)
    .to(0, out, ease.inOut);

  return (
    <Sequence clock={part.clock}>
      <Shape
        geometry={rect(SIZE[0], SIZE[1])}
        fill={theme.background}
        opacity={shown.map((v) => v * 0.62)}
        mask={
          <Shape
            geometry={rect(SIZE[0], SIZE[1])}
            fill={radial({
              center: part.target,
              radius: part.reach,
              stops: [
                [0, "#00000000"],
                [0.82, "#00000000"],
                [1, "#000000"],
              ],
            })}
          />
        }
      />
      <Shape
        ref={ring}
        geometry={ellipse(part.ring[0], part.ring[1])}
        at={part.target}
        anchor="center"
        stroke={{ color: theme.blue, width: 1.5, dash: [6, 6] }}
        draw={track(0).to(1, span(at + 0.8, 0.6), ease.inOut)}
        opacity={track(1).to(0, out)}
      />
      <Group motion={[enter(span(at + 0.85, 0.5)), exit(out)]}>
        <Group ref={label}>
          <Text
            font={geist}
            weight={600}
            size={26}
            at={part.label}
            anchor={part.align}
            fill={theme.text}
          >
            {part.name}
          </Text>
          <Text
            font={mono}
            size={13}
            at={add(part.label, [0, 26])}
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
          .to(1, span(at + 0.95, 0.45))
          .to(0, out)}
      />
      {part.cues.map(([from, to, bend], index) => (
        <Arrow
          key={`${part.clock.name}-cue-${index}`}
          from={seen(part, from)}
          to={seen(part, to)}
          bend={bend}
          stroke={{ color: theme.blue, width: 3, cap: "round" }}
          head={11}
          draw={track(0)
            .to(1, span(at + 1, 0.4))
            .to(0, out)}
        />
      ))}
    </Sequence>
  );
};

/** Each state rests every part's clock before its move, but the part it focuses, which rests where it has arrived. */
const away = {
  lens: LENS_IN / D,
  ...Object.fromEntries(PARTS.map((part) => [part.clock.name, timeOf(part) / D])),
};

const focused = (part: Part) => ({
  ...away,
  lens: (LENS_IN + MOVE) / D,
  [part.clock.name]: (timeOf(part) + SETTLE) / D,
});

const STATES = {
  "motion.playing": { tick: looping },
  "motion.paused": {},
  "focus.overview": away,
  "focus.escape": focused(escape),
  "focus.fork": focused(pallet),
  "focus.balance": focused(wheel),
};

const Plate = (): SceneElement => (
  <Shape
    geometry={rect(SIZE[0] * 3, SIZE[1] * 3)}
    at={[-SIZE[0], -SIZE[1]]}
    fill={pattern({
      size: [40, 40],
      tile: (
        <Group>
          {(
            [
              [20, 20],
              [0, 0],
              [40, 0],
              [0, 40],
              [40, 40],
            ] as const
          ).map((c) => (
            <Shape
              key={`groove-${c[0]}-${c[1]}`}
              geometry={circle(17)}
              at={c}
              anchor="center"
              stroke={{ color: material.groove, width: 1 }}
            />
          ))}
        </Group>
      ),
    })}
  />
);

export default scene(
  {
    size: SIZE,
    duration: D,
    title: "How a watch escapement keeps time",
    desc: "A Swiss lever escapement running ten times slower than life. The balance wheel swings on its hairspring, its pin throws the pallet fork from one banking pin to the other, and each throw lets the escape wheel advance half a tooth before a ruby stone locks it again. A camera zooms in on the escape wheel, the pallet fork and the balance wheel in turn, each with its name and a leader line, and pulls back out.",
    theme,
    still: 2.4,
    states: STATES,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={material.plate} />
      <Lens>
        <Camera part={escape}>
          <Camera part={pallet}>
            <Camera part={wheel}>
              <Plate />
              <Mechanism />
            </Camera>
          </Camera>
        </Camera>
      </Lens>
      <Overview part={escape}>
        <Overview part={pallet}>
          <Overview part={wheel}>
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
          </Overview>
        </Overview>
      </Overview>
      {PARTS.map((part) => (
        <Focus key={part.clock.name} part={part} />
      ))}
    </Group>
  ),
);
