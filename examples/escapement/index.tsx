import {
  Ambient,
  Camera,
  Pivot,
  css,
  def,
  draw,
  ease,
  motion,
  render,
  sampled,
  show,
  type Rect,
  type SvgNode,
} from "svjeez";
import { rect } from "svjeez/geometry";
import {
  BALANCE,
  FORK,
  PIN,
  PITCH,
  REACH,
  SWING,
  TEETH,
  WHEEL0,
  balanceAt,
  entry,
  exit,
  forkAt,
  polar,
  tooth,
  turn,
  wheelAt,
  type P,
} from "./mechanism.ts";

// A watch movement from the mainspring barrel to the balance, running ten times slower than life: a beat every two
// seconds, with the wheels turning at gentler ratios than a real train. The mechanism is on the clock and never stops. The camera's tour
// of it is the scene's timeline, so a page can hand that to the scroll with restyle({ timeline }) while everything
// inside <Ambient> plays on.
// Three numbers move every part: the balance's angle, the escape wheel's steady advance and its stepping about that
// advance. The train's wheels and the hairspring's turns read them through calc(), so the whole movement is a handful of
// short keyframes however many parts follow.

const SIZE = 1000;
const FRAME = rect(0, 0, SIZE, SIZE);

/** One loop: thirty beats, which turn the escape wheel once, and the camera's tour of the movement. */
export const D = 60;
const BEATS = 30;

/** Scene seconds for a swing there and back, two beats. */
const SWING_TIME = (2 * D) / BEATS;

const add = ([x, y]: P, [dx, dy]: P): P => [x + dx, y + dy];

const along = ([x, y]: P, distance: number, deg: number): P => [
  x + distance * Math.cos((deg * Math.PI) / 180),
  y + distance * Math.sin((deg * Math.PI) / 180),
];

const n = (v: number, places = 1) => String(Number(v.toFixed(places)));
const at = (p: P, places = 1) => n(p[0], places) + " " + n(p[1], places);

// ---- Where everything sits. The escapement stands upright; the train runs down and to the left of it.

const ESCAPE: P = [761, 474];
const PIVOT = add(ESCAPE, FORK);
const STAFF = add(ESCAPE, BALANCE);

interface Gear {
  readonly c: P;
  readonly teeth: number;
  /** Pitch radius. */
  readonly r: number;
  /** Where one tooth points, in degrees clockwise from up. */
  readonly a: number;
}

/** The angle that sets a gear's teeth into the gaps of the one driving it. */
const mesh = (from: Gear, c: P, teeth: number): number => {
  const toward = (Math.atan2(c[0] - from.c[0], -(c[1] - from.c[1])) * 180) / Math.PI;
  const pitch = 360 / from.teeth;
  const f = ((((toward - from.a) / pitch) % 1) + 1) % 1;

  return toward + 180 - (0.5 - f) * (360 / teeth);
};

/** Every mesh shares one tooth size, so a gear's radius follows from its tooth count. */
const MODULE = 4.5;

/** The gear driven by `from`, set `deg` degrees clockwise from the horizontal and touching it. */
const driven = (from: Gear, teeth: number, deg: number): Gear => {
  const r = (MODULE * teeth) / 2;
  const c = along(from.c, from.r + r, deg);

  return { c, teeth, r, a: mesh(from, c, teeth) };
};

/** The pinion on the same arbor as a wheel. */
const pinionOf = (wheel: Gear, teeth: number): Gear => ({
  ...wheel,
  teeth,
  r: (MODULE * teeth) / 2,
});

// Built backwards from the escape wheel, whose angle the kinematics give.
/** The beat count the loop starts on: the balance at the end of its swing and the wheel locked. */
const BEAT0 = 0.5;
const escapePinion: Gear = { c: ESCAPE, teeth: 16, r: 36, a: WHEEL0 + wheelAt(BEAT0) };
const fourth = driven(escapePinion, 32, 110);
const fourthPinion = pinionOf(fourth, 24);
const third = driven(fourthPinion, 48, 155);
const thirdPinion = pinionOf(third, 32);
const center = driven(thirdPinion, 48, 240);
const centerPinion = pinionOf(center, 36);
const barrel = driven(centerPinion, 54, 150);
const barrelAt = barrel.c;
const thirdAt = third.c;
const fourthAt = fourth.c;
const centerAt = center.c;

// ---- The three numbers.

const theta = css.property("theta", { syntax: "angle", inherits: true, initial: 0 });

/** The escape wheel's angle is its steady advance plus how far its stepping is ahead of or behind that. */
const advance = css.property("advance", { syntax: "angle", inherits: true, initial: 0 });
const stepping = css.property("stepping", { syntax: "angle", inherits: true, initial: 0 });

const beatAt = (t: number) => BEAT0 + (t * BEATS) / D;
const STEP = 0.004;

const swing = sampled({ at: 0, over: SWING_TIME }, (t) => ({ [theta]: balanceAt(beatAt(t)) }), {
  step: STEP,
  tolerance: { [theta]: 0.5 },
  precision: 1,
}).loop(SWING_TIME);

const steps = sampled(
  { at: 0, over: SWING_TIME },
  (t) => ({ [stepping]: wheelAt(beatAt(t)) - wheelAt(BEAT0) - (PITCH / 2) * (beatAt(t) - BEAT0) }),
  { step: STEP, tolerance: { [stepping]: 0.04 }, precision: 2 },
).loop(SWING_TIME);

const advancing = motion({ [advance]: 0 }).to({ [advance]: (PITCH / 2) * BEATS }, D, ease.linear);

const rocking = sampled(
  { at: 0, over: SWING_TIME },
  (t) => ({ rotate: forkAt(balanceAt(beatAt(t))) }),
  { step: STEP, tolerance: { rotate: 0.04 }, precision: 2 },
).loop(SWING_TIME);

/** A part that turns about a point by a multiple of the balance's angle or the escape wheel's. */
const Turns = ({
  about,
  by,
  of,
  children,
}: {
  about: P;
  by: number;
  of: "balance" | "wheel";
  children: SvgNode;
}) => {
  const ratio = Number(n(by, 5));

  return (
    <g
      style={{
        transformOrigin: n(about[0]) + "px " + n(about[1]) + "px",
        rotate:
          of === "balance"
            ? css`calc(${theta} * ${ratio})`
            : css`calc((${advance} + ${stepping}) * ${ratio})`,
      }}
    >
      {children}
    </g>
  );
};

// ---- Shapes.

type Hex = `#${string}`;

const BRASS: Hex = "#C39A52";
const BRASS_EDGE = "#6E5626";
const GILT: Hex = "#D9BC7A";
const STEEL = "#B4BCC8";
const STEEL_EDGE = "#4E5663";
const RUBY = "#E0356A";
const RUBY_EDGE = "#7C1236";
const INK = "#ECE9E2";
const DIM = "#96928A";
export const GROUND = "#0E1014";
const FONT = "system-ui, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** The outline of a gear's teeth: straight flanks to the pitch circle and an ogive above it, as watch wheels are cut. */
const teethOf = ({ c, teeth, r, a }: Gear, places = 1) => {
  const m = (2 * r) / teeth;
  const pitch = 360 / teeth;
  const root = r - 1.3 * m;
  const pt = (radius: number, deg: number) => at(add(c, polar(radius, deg)), places);
  let d = "";

  for (let i = 0; i < teeth; i++) {
    const mid = a + i * pitch;
    d +=
      (i ? "L" : "M") +
      pt(root, mid - 0.3 * pitch) +
      "L" +
      pt(r, mid - 0.25 * pitch) +
      "Q" +
      pt(r + 2.1 * m, mid) +
      " " +
      pt(r, mid + 0.25 * pitch) +
      "L" +
      pt(root, mid + 0.3 * pitch);
  }

  return d + "Z";
};

/** The windows between a wheel's spokes, to cut out of its disk. */
const windows = (
  c: P,
  inner: number,
  outer: number,
  spokes: number,
  width: number,
  a: number,
  places = 1,
) => {
  const half = (radius: number) => (Math.asin(width / 2 / radius) * 180) / Math.PI;
  let d = "";

  for (let i = 0; i < spokes; i++) {
    const from = a + (i * 360) / spokes;
    const to = from + 360 / spokes;
    const p = (radius: number, deg: number) => at(add(c, polar(radius, deg)), places);
    d +=
      "M" +
      p(inner, from + half(inner)) +
      "L" +
      p(outer, from + half(outer)) +
      "A" +
      n(outer) +
      " " +
      n(outer) +
      " 0 0 1 " +
      p(outer, to - half(outer)) +
      "L" +
      p(inner, to - half(inner)) +
      "A" +
      n(inner) +
      " " +
      n(inner) +
      " 0 0 0 " +
      p(inner, from + half(inner)) +
      "Z";
  }

  return d;
};

const Wheel = ({
  gear,
  spokes,
  fill,
  hub = 0.16,
}: {
  gear: Gear;
  spokes: number;
  fill: Hex;
  hub?: number;
}) => {
  const m = (2 * gear.r) / gear.teeth;
  const rim = gear.r - 1.3 * m - 2.6 * m;

  return (
    <path
      d={teethOf(gear) + windows(gear.c, gear.r * hub, rim, spokes, gear.r * 0.085, gear.a)}
      fill={fill}
      fillRule="evenodd"
      stroke={BRASS_EDGE}
      strokeWidth={0.6}
      strokeLinejoin="round"
    />
  );
};

/** A fine light line just inside a wheel's teeth, where the rim is bevelled. */
const Bevel = ({ gear }: { gear: Gear }) => (
  <circle
    cx={gear.c[0]}
    cy={gear.c[1]}
    r={Number(n(gear.r - (2.6 * gear.r) / gear.teeth - 1.6))}
    fill="none"
    stroke="#F3E2B4"
    strokeOpacity={0.55}
    strokeWidth={0.7}
  />
);

const Pinion = ({ gear }: { gear: Gear }) => (
  <>
    <path
      d={teethOf(gear, 2)}
      fill={STEEL}
      stroke={STEEL_EDGE}
      strokeWidth={0.5}
      strokeLinejoin="round"
    />
    <circle cx={gear.c[0]} cy={gear.c[1]} r={gear.r * 0.3} fill={STEEL_EDGE} />
  </>
);

/** A ring of shadow under a wheel's rim, which stays put while the wheel turns. */
const Shade = ({ gear }: { gear: Gear }) => (
  <circle
    cx={gear.c[0] + 2.5}
    cy={gear.c[1] + 4}
    r={gear.r * 0.94}
    fill="none"
    stroke="#000"
    strokeOpacity={0.32}
    strokeWidth={gear.r * 0.14}
  />
);

const Jewel = ({ c, r = 4.2 }: { c: P; r?: number }) => (
  <>
    <circle cx={c[0]} cy={c[1]} r={r} fill={RUBY} stroke={RUBY_EDGE} strokeWidth={0.5} />
    <circle cx={c[0]} cy={c[1]} r={r * 0.36} fill={STEEL} />
  </>
);

/** An Archimedean spiral from one radius to another around a center, as arcs of 30° that each take the radius they pass. */
const spiral = (c: P, from: number, to: number, a0: number, a1: number, places = 1) => {
  const count = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 30));
  const radius = (u: number) => from + (to - from) * u;
  let d = "M" + at(add(c, polar(from, a0)), places);

  for (let i = 1; i <= count; i++) {
    const r = n(radius((i - 0.5) / count), places);
    d +=
      "A" +
      r +
      " " +
      r +
      " 0 0 " +
      (a1 > a0 ? 1 : 0) +
      " " +
      at(add(c, polar(radius(i / count), a0 + ((a1 - a0) * i) / count)), places);
  }

  return d;
};

const escapeWheel = (() => {
  const p = (q: P, k: number) => at(add(ESCAPE, turn(q, k * PITCH)), 2);

  // SAFETY: `tooth` is the seven-point outline built in mechanism.ts, in this order.
  const [toe, heel, back, neckBack, rootBack, rootFront, neckFront] = tooth as [
    P,
    P,
    P,
    P,
    P,
    P,
    P,
  ];

  let d = "";

  for (let k = 0; k < TEETH; k++)
    d +=
      (k ? "L" : "M") +
      p(rootBack, k) +
      "L" +
      p(neckBack, k) +
      "L" +
      p(back, k) +
      "L" +
      p(heel, k) +
      "L" +
      p(toe, k) +
      "L" +
      p(neckFront, k) +
      "L" +
      p(rootFront, k) +
      "A42 42 0 0 1 " +
      p(rootBack, k + 1);

  return d + "Z" + windows(ESCAPE, 8.5, 36.5, 5, 4.2, 0, 2);
})();

/** The hairspring in slices from the stud inward. Slice j turns j / SLICES of the balance's angle, so the coils open and close. */
const SLICES = 10;
const COILS = 8.5;

const hairspring = Array.from({ length: SLICES + 1 }, (_, j) => {
  const pad = (SWING / SLICES / 2 / (360 * COILS)) * 1.1;
  const u0 = Math.max(0, (j - 0.5) / SLICES - pad);
  const u1 = Math.min(1, (j + 0.5) / SLICES + pad);
  const radius = (u: number) => 41 - 32 * u;
  const angle = (u: number) => 62 + 360 * COILS * u;

  return (
    <Turns about={STAFF} by={j / SLICES} of="balance">
      <path
        d={spiral(STAFF, radius(u0), radius(u1), angle(u0), angle(u1), 2)}
        fill="none"
        stroke="#6F8FE8"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    </Turns>
  );
});

const balanceWheel = (() => {
  const ring = (r: number) =>
    "M" +
    at(add(STAFF, [r, 0])) +
    "A" +
    r +
    " " +
    r +
    " 0 1 0 " +
    at(add(STAFF, [-r, 0])) +
    "A" +
    r +
    " " +
    r +
    " 0 1 0 " +
    at(add(STAFF, [r, 0])) +
    "Z";

  return ring(88) + windows(STAFF, 9, 77, 3, 7, 30, 2);
})();

/** The fork with the lever on the line of centers: the lever with its slot for the pin, and the anchor that holds the stones. */
const fork = (() => {
  const top = FORK[1] - (REACH - PIN);
  const q = (x: number, y: number) => at(add(ESCAPE, [x, y]), 2);
  const y0 = FORK[1];

  const lever =
    "M" +
    q(-4.6, y0) +
    "L" +
    q(-2.6, top + 16) +
    "L" +
    q(-7.4, top + 5) +
    "L" +
    q(-7.4, top - 4.5) +
    "L" +
    q(-2.5, top - 4.5) +
    "L" +
    q(-2.5, top + 3.2) +
    "L" +
    q(2.5, top + 3.2) +
    "L" +
    q(2.5, top - 4.5) +
    "L" +
    q(7.4, top - 4.5) +
    "L" +
    q(7.4, top + 5) +
    "L" +
    q(2.6, top + 16) +
    "L" +
    q(4.6, y0) +
    "Z";

  const mid = (s: readonly P[]): P => [(s[2]![0] + s[3]![0]) / 2, (s[2]![1] + s[3]![1]) / 2];

  const anchor =
    "M" +
    q(...mid(entry)) +
    "Q" +
    q(-14, y0 - 3) +
    " " +
    q(0, y0) +
    "Q" +
    q(14, y0 - 3) +
    " " +
    q(...mid(exit));

  return { lever, anchor };
})();

const stoneD = (s: readonly P[]) => "M" + s.map((p) => at(add(ESCAPE, p), 2)).join("L") + "Z";

// ---- The camera's tour, and what is said at each stop.

const view = (cx: number, cy: number, size: number): Rect =>
  rect(cx - size / 2, cy - size / 2, size, size);

const WIDE = view(487, 505, 790);

/** Each stop: when the camera sets off for it, how long the move takes, and how long it then stays. */
const TOUR = [
  { name: "open", at: 0, move: 0, target: WIDE },
  { name: "barrel", at: 4, move: 5, target: view(424, 556, 560) },
  { name: "train", at: 14, move: 5, target: view(646, 612, 430) },
  { name: "escapement", at: 24, move: 5, target: view(768, 398, 350) },
  { name: "pin", at: 34, move: 4, target: view(761, 352, 120) },
  { name: "stones", at: 42, move: 4, target: view(761, 432, 140) },
  { name: "close", at: 51, move: 6, target: WIDE },
] as const;

const stops = TOUR.map(({ at: when, move, target }, i) => ({
  show: { at: when, over: (TOUR[i + 1]?.at ?? D) - when },
  target,
  over: move || undefined,
}));

/** The span a stop is held for, once the camera has arrived, with a little of the moves either side. */
const held = (name: (typeof TOUR)[number]["name"], lead = 1): readonly [number, number] => {
  const i = TOUR.findIndex((stop) => stop.name === name);

  return [TOUR[i]!.at + TOUR[i]!.move - lead, (TOUR[i + 1]?.at ?? D) + 0.4];
};

interface Note {
  readonly name: string;
  readonly note?: string;
  /** Where the words start, and the part they point at. */
  readonly at: P;
  readonly to: P;
  /** The width of the view it is read in, which sets its size. */
  readonly view: number;
  /** The stop it is read at, and how long after the first words of that stop it comes in. */
  readonly stop: (typeof TOUR)[number]["name"];
  readonly after?: number;
  readonly end?: boolean;
}

const Label = ({ name, note, at: [x, y], to, view: width, stop, after = 0, end }: Note) => {
  const [start, until] = held(stop);
  const from = start + after;
  const size = (width / SIZE) * 30;
  // The line leaves the words on the side the part is on. Nothing here measures text, so their width is a guess.
  const wide = name.length * size * 0.56;
  const far = end ? to[0] < x - wide / 2 : to[0] > x + wide / 2;
  const under = note !== undefined && to[1] > y + size * 1.6;

  const tail: P = under
    ? [x + (end ? -1 : 1) * size * 0.4, y + size * 1.6]
    : [x + (end ? -1 : 1) * (far ? wide + size * 0.35 : -size * 0.35), y - size * 0.32];

  return (
    <g animation={show({ at: from, over: until - from }, { fade: 0.8 })}>
      <path
        d={"M" + at(tail, 2) + "L" + at(to, 2)}
        fill="none"
        stroke={INK}
        strokeOpacity={0.7}
        strokeWidth={size * 0.05}
        animation={draw({ at: from + 0.2, over: 1 })}
      />
      <circle cx={to[0]} cy={to[1]} r={size * 0.14} fill={INK} />
      <text
        x={x}
        y={y}
        textAnchor={end ? "end" : "start"}
        fontFamily={FONT}
        fontSize={Number(n(size, 2))}
        fontWeight={600}
        fill={INK}
        stroke={GROUND}
        strokeWidth={Number(n(size * 0.22, 2))}
        strokeLinejoin="round"
        style={{ paintOrder: "stroke" }}
      >
        {name}
      </text>
      {note && (
        <text
          x={x}
          y={y + size * 1.2}
          textAnchor={end ? "end" : "start"}
          fontFamily={FONT}
          fontSize={Number(n(size * 0.8, 2))}
          fill={DIM}
        >
          {note}
        </text>
      )}
    </g>
  );
};

const notes: readonly Note[] = [
  {
    name: "Barrel",
    note: "54 teeth",
    at: [166, 318],
    to: add(barrelAt, polar(barrel.r + 6, -22)),
    view: 560,
    stop: "barrel",
  },
  {
    name: "Centre wheel",
    note: "48 teeth",
    at: [470, 310],
    to: add(centerAt, polar(center.r + 3, 22)),
    view: 560,
    stop: "barrel",
    after: 0.6,
  },
  {
    name: "Third wheel",
    note: "48 teeth",
    at: [446, 786],
    to: add(thirdAt, polar(third.r + 3, 205)),
    view: 430,
    stop: "train",
  },
  {
    name: "Fourth wheel",
    note: "32 teeth",
    at: [846, 760],
    to: add(fourthAt, polar(fourth.r + 3, 140)),
    view: 430,
    stop: "train",
    after: 0.6,
    end: true,
  },
  {
    name: "Balance",
    note: "5 beats a second",
    at: [606, 262],
    to: add(STAFF, polar(88, -75)),
    view: 350,
    stop: "escapement",
  },
  {
    name: "Pallet fork",
    at: [606, 388],
    to: add(PIVOT, [-5, -30]),
    view: 350,
    stop: "escapement",
    after: 0.5,
  },
  {
    name: "Escape wheel",
    note: "1 turn in 6 s",
    at: [930, 500],
    to: add(ESCAPE, polar(57, 84)),
    view: 350,
    stop: "escapement",
    after: 1,
    end: true,
  },
  { name: "Fork", at: [707, 400], to: add(PIVOT, [-4, -44]), view: 120, stop: "pin" },
  {
    name: "Banking pin",
    at: [815, 400],
    to: add(PIVOT, [10.4, -29]),
    view: 120,
    stop: "pin",
    after: 0.5,
    end: true,
  },
  {
    name: "Entry stone",
    at: [697, 386],
    to: add(ESCAPE, add(entry[3]!, [-0.5, 2])),
    view: 140,
    stop: "stones",
  },
  {
    name: "Exit stone",
    at: [825, 386],
    to: add(ESCAPE, add(exit[2]!, [0.5, 1])),
    view: 140,
    stop: "stones",
    after: 0.5,
    end: true,
  },
];

/** What a page can say beside the scene, and the scene seconds each holds for. */
export const moments = {
  wide: [0, 5.5],
  barrel: held("barrel", 2.5),
  train: held("train", 2.5),
  escapement: held("escapement", 2.5),
  pin: held("pin", 2),
  stones: held("stones", 2),
  all: [54.5, D],
} as const;

export default function build(options: { prefix?: string } = {}): string {
  const lean = WHEEL0 + wheelAt(BEAT0);
  // Each arbor turns by the tooth ratio of the mesh before it, the other way. The escape wheel's 360° a loop gives the
  // fourth 180°, the third 90°, the centre wheel 60° and the barrel 40°: gentler than a real train, which gears up
  // 10, 7.5, 8 and 6 times, and each a whole number of teeth and spokes, so the loop closes on the picture it began on.
  const fourthBy = -escapePinion.teeth / fourth.teeth;
  const thirdBy = (-fourthBy * fourthPinion.teeth) / third.teeth;
  const centerBy = (-thirdBy * thirdPinion.teeth) / center.teeth;
  const barrelBy = (-centerBy * centerPinion.teeth) / barrel.teeth;

  const arm = def.symbol(
    { style: "overflow:visible" },
    <path
      d={spiral(barrelAt, 100, 34, 0, 200, 1)}
      fill="none"
      stroke="#8C96A8"
      strokeWidth={4.2}
      strokeLinecap="round"
    />,
  );

  return render(
    {
      width: SIZE,
      height: SIZE,
      duration: D,
      title: "A watch movement running, from the barrel to the escapement",
      desc: "A mechanical watch movement runs ten times slower than life: the balance swings, its pin throws the pallet fork from side to side, and the escape wheel steps a tooth at a time, turning the fourth and third wheels behind it. The view travels from the mainspring barrel down the train to the escapement, closes in on the impulse pin and then on the two ruby stones, and pulls back.",
      reducedMotion: { at: 31 },
      ...options,
    },
    <>
      <rect width={SIZE} height={SIZE} fill={GROUND} />
      <g clipPath={def.clipPath({}, <rect width={SIZE} height={SIZE} />)}>
        <Camera frame={FRAME} stops={stops}>
          <>
            <Ambient animation={[swing, advancing, steps]}>
              <Turns about={ESCAPE} by={1} of="wheel">
                <Pinion gear={escapePinion} />
              </Turns>

              <Shade gear={fourth} />
              <Turns about={fourthAt} by={fourthBy} of="wheel">
                <>
                  <Pinion gear={fourthPinion} />
                  <Wheel gear={fourth} spokes={6} fill={GILT} />
                  <Bevel gear={fourth} />
                </>
              </Turns>

              <Shade gear={third} />
              <Turns about={thirdAt} by={thirdBy} of="wheel">
                <>
                  <Pinion gear={thirdPinion} />
                  <Wheel gear={third} spokes={4} fill={BRASS} />
                  <Bevel gear={third} />
                </>
              </Turns>

              <Shade gear={center} />
              <Turns about={centerAt} by={centerBy} of="wheel">
                <>
                  <Pinion gear={centerPinion} />
                  <Wheel gear={center} spokes={6} fill={GILT} />
                  <Bevel gear={center} />
                </>
              </Turns>

              <Shade gear={barrel} />
              <Turns about={barrelAt} by={barrelBy} of="wheel">
                <>
                  <path
                    d={teethOf(barrel)}
                    fill={BRASS}
                    stroke={BRASS_EDGE}
                    strokeWidth={0.6}
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={barrelAt[0]}
                    cy={barrelAt[1]}
                    r={barrel.r * 0.88}
                    fill="#17191E"
                    stroke={BRASS_EDGE}
                    strokeWidth={1}
                  />
                  {Array.from({ length: 9 }, (_, i) => (
                    <use
                      href={arm}
                      transform={
                        "rotate(" + i * 40 + " " + n(barrelAt[0], 2) + " " + n(barrelAt[1], 2) + ")"
                      }
                    />
                  ))}
                  <circle
                    cx={barrelAt[0]}
                    cy={barrelAt[1]}
                    r={24}
                    fill={STEEL}
                    stroke={STEEL_EDGE}
                    strokeWidth={0.8}
                  />
                  <circle cx={barrelAt[0]} cy={barrelAt[1]} r={8} fill={STEEL_EDGE} />
                </>
              </Turns>
              <Shade gear={{ ...fourth, r: 60 / 0.94 / 1.9, c: ESCAPE }} />
              <Turns about={ESCAPE} by={1} of="wheel">
                <g transform={"rotate(" + n(lean, 3) + " " + ESCAPE[0] + " " + ESCAPE[1] + ")"}>
                  <path
                    d={escapeWheel}
                    fill={STEEL}
                    fillRule="evenodd"
                    stroke={STEEL_EDGE}
                    strokeWidth={0.4}
                    strokeLinejoin="round"
                  />
                </g>
              </Turns>
              <Jewel c={thirdAt} />
              <Jewel c={fourthAt} />

              <Turns about={STAFF} by={1} of="balance">
                <path
                  d={balanceWheel}
                  fill={GILT}
                  fillRule="evenodd"
                  stroke={BRASS_EDGE}
                  strokeWidth={0.5}
                />
              </Turns>
              {hairspring}
              <circle
                cx={STAFF[0] + polar(41, 62)[0]}
                cy={STAFF[1] + polar(41, 62)[1]}
                r={2.2}
                fill={STEEL}
                stroke={STEEL_EDGE}
                strokeWidth={0.4}
              />

              {[-1, 1].map((side) => (
                <circle
                  cx={PIVOT[0] + side * 8.6}
                  cy={PIVOT[1] - 30}
                  r={2.2}
                  fill={STEEL}
                  stroke={STEEL_EDGE}
                  strokeWidth={0.4}
                />
              ))}
              <Pivot origin={{ x: PIVOT[0], y: PIVOT[1] }} animation={rocking}>
                <path
                  d={fork.anchor}
                  fill="none"
                  stroke={STEEL_EDGE}
                  strokeWidth={9.8}
                  strokeLinecap="round"
                />
                <path
                  d={fork.anchor}
                  fill="none"
                  stroke={STEEL}
                  strokeWidth={9}
                  strokeLinecap="round"
                />
                <path
                  d={fork.lever}
                  fill={STEEL}
                  stroke={STEEL_EDGE}
                  strokeWidth={0.4}
                  strokeLinejoin="round"
                />
                <path
                  d={stoneD(entry)}
                  fill={RUBY}
                  stroke={RUBY_EDGE}
                  strokeWidth={0.3}
                  strokeLinejoin="round"
                />
                <path
                  d={stoneD(exit)}
                  fill={RUBY}
                  stroke={RUBY_EDGE}
                  strokeWidth={0.3}
                  strokeLinejoin="round"
                />
              </Pivot>
              <Jewel c={PIVOT} r={3.4} />
              <Jewel c={ESCAPE} r={3.4} />

              <Turns about={STAFF} by={1} of="balance">
                <>
                  <circle
                    cx={STAFF[0]}
                    cy={STAFF[1]}
                    r={PIN + 4.5}
                    fill={STEEL}
                    fillOpacity={0.28}
                    stroke={STEEL}
                    strokeWidth={0.6}
                  />
                  <circle
                    cx={STAFF[0]}
                    cy={STAFF[1] + PIN}
                    r={2.2}
                    fill={RUBY}
                    stroke={RUBY_EDGE}
                    strokeWidth={0.3}
                  />
                </>
              </Turns>
              <Jewel c={STAFF} r={5} />
            </Ambient>
            {notes.map((note) => (
              <Label {...note} />
            ))}
          </>
        </Camera>
      </g>
    </>,
  );
}
