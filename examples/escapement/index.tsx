import {
  Group,
  Instance,
  Shape,
  Text,
  canvas,
  circle,
  draw,
  ease,
  enter,
  exit,
  line,
  pathData,
  sampled,
  scene,
  span,
  subtract,
  symbol,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import type { Child } from "svjeez/tools";
import { mono } from "../theme";
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
  exit as exitStone,
  forkAt,
  polar,
  tooth,
  turn,
  wheelAt,
  type P,
} from "./mechanism";

const SIZE = 1000;
const D = 60;
const BEATS = 30;
const SWING_TIME = (2 * D) / BEATS;
const BEAT0 = 0.5;
const MODULE = 4.5;

const BRASS = "#C39A52";
const BRASS_EDGE = "#6E5626";
const GILT = "#D9BC7A";
const STEEL = "#B4BCC8";
const STEEL_EDGE = "#4E5663";
const RUBY = "#E0356A";
const RUBY_EDGE = "#7C1236";
const INK = "#ECE9E2";
const DIM = "#96928A";
const GROUND = "#0E1014";

const add = ([x, y]: P, [dx, dy]: P): Vec => [x + dx, y + dy];
const n = (v: number, places = 1): string => String(Number(v.toFixed(places)));
const pt = (p: P, places = 1): string => n(p[0], places) + " " + n(p[1], places);

const ESCAPE: Vec = [761, 474];
const PIVOT = add(ESCAPE, FORK);
const STAFF = add(ESCAPE, BALANCE);

interface Gear {
  readonly c: Vec;
  readonly teeth: number;
  readonly r: number;
  readonly a: number;
}

const mesh = (from: Gear, c: Vec, teeth: number): number => {
  const toward = (Math.atan2(c[0] - from.c[0], -(c[1] - from.c[1])) * 180) / Math.PI;
  const pitch = 360 / from.teeth;
  const f = ((((toward - from.a) / pitch) % 1) + 1) % 1;

  return toward + 180 - (0.5 - f) * (360 / teeth);
};

const driven = (from: Gear, teeth: number, deg: number): Gear => {
  const r = (MODULE * teeth) / 2;

  const c = add(from.c, [
    (from.r + r) * Math.cos((deg * Math.PI) / 180),
    (from.r + r) * Math.sin((deg * Math.PI) / 180),
  ]);

  return { c, teeth, r, a: mesh(from, c, teeth) };
};

const pinionOf = (wheel: Gear, teeth: number): Gear => ({
  ...wheel,
  teeth,
  r: (MODULE * teeth) / 2,
});

const escapePinion: Gear = { c: ESCAPE, teeth: 16, r: 36, a: WHEEL0 + wheelAt(BEAT0) };
const fourth = driven(escapePinion, 32, 110);
const fourthPinion = pinionOf(fourth, 24);
const third = driven(fourthPinion, 48, 155);
const thirdPinion = pinionOf(third, 32);
const center = driven(thirdPinion, 48, 240);
const centerPinion = pinionOf(center, 36);
const barrel = driven(centerPinion, 54, 150);

const fourthBy = -escapePinion.teeth / fourth.teeth;
const thirdBy = (-fourthBy * fourthPinion.teeth) / third.teeth;
const centerBy = (-thirdBy * thirdPinion.teeth) / center.teeth;
const barrelBy = (-centerBy * centerPinion.teeth) / barrel.teeth;

const beatAt = (t: number): number => BEAT0 + (t * BEATS) / D;
const swing = span(0, SWING_TIME);
const sine = ease.bezier(0.37, 0, 0.63, 1);
const [there, back] = span(0, SWING_TIME / 2).chain(SWING_TIME / 2);

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

const teethOf = ({ teeth, r, a }: Gear, places = 1): string => {
  const m = (2 * r) / teeth;
  const pitch = 360 / teeth;
  const root = r - 1.3 * m;
  const at = (radius: number, deg: number): string => pt(polar(radius, deg), places);
  let d = "";

  for (let i = 0; i < teeth; i++) {
    const mid = a + i * pitch;
    d +=
      (i ? "L" : "M") +
      at(root, mid - 0.3 * pitch) +
      "L" +
      at(r, mid - 0.25 * pitch) +
      "Q" +
      at(r + 2.1 * m, mid) +
      " " +
      at(r, mid + 0.25 * pitch) +
      "L" +
      at(root, mid + 0.3 * pitch);
  }

  return d + "Z";
};

const windows = (
  inner: number,
  outer: number,
  spokes: number,
  width: number,
  a: number,
  places = 1,
): string[] => {
  const half = (radius: number): number => (Math.asin(width / 2 / radius) * 180) / Math.PI;
  const at = (radius: number, deg: number): string => pt(polar(radius, deg), places);

  return Array.from({ length: spokes }, (_, i) => {
    const from = a + (i * 360) / spokes;
    const to = from + 360 / spokes;

    return (
      "M" +
      at(inner, from + half(inner)) +
      "L" +
      at(outer, from + half(outer)) +
      "A" +
      n(outer) +
      " " +
      n(outer) +
      " 0 0 1 " +
      at(outer, to - half(outer)) +
      "L" +
      at(inner, to - half(inner)) +
      "A" +
      n(inner) +
      " " +
      n(inner) +
      " 0 0 0 " +
      at(inner, from + half(inner)) +
      "Z"
    );
  });
};

const pierced = (outline: string, holes: readonly string[]) =>
  subtract(pathData(outline), ...holes.map(pathData));

const spiral = (from: number, to: number, a0: number, a1: number, places = 1): string => {
  const count = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 30));
  const radius = (u: number): number => from + (to - from) * u;
  let d = "M" + pt(polar(from, a0), places);

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
      pt(polar(radius(i / count), a0 + ((a1 - a0) * i) / count), places);
  }

  return d;
};

const Axle = ({
  gear,
  by,
  children,
}: {
  readonly gear: Gear;
  readonly by: number;
  readonly children: Child;
}): SceneElement => (
  <Group at={gear.c} origin="at" rotate={advance.map((a) => a * by)}>
    <Group origin="at" rotate={stepping.map((s) => s * by)}>
      {children}
    </Group>
  </Group>
);

const Wheel = ({
  gear,
  spokes,
  fill,
}: {
  readonly gear: Gear;
  readonly spokes: number;
  readonly fill: Paint;
}): SceneElement => {
  const m = (2 * gear.r) / gear.teeth;
  const rim = gear.r - 3.9 * m;

  return (
    <Shape
      geometry={pierced(teethOf(gear), windows(gear.r * 0.16, rim, spokes, gear.r * 0.085, gear.a))}
      fill={fill}
      stroke={{ color: BRASS_EDGE, width: 0.6, join: "round" }}
    />
  );
};

const Bevel = ({ gear }: { readonly gear: Gear }): SceneElement => (
  <Shape
    geometry={circle(Number(n(gear.r - (2.6 * gear.r) / gear.teeth - 1.6)))}
    anchor="center"
    stroke={{ color: "#F3E2B48C", width: 0.7 }}
  />
);

const Pinion = ({ gear }: { readonly gear: Gear }): SceneElement => (
  <Group>
    <Shape
      geometry={pathData(teethOf(gear, 2))}
      fill={STEEL}
      stroke={{ color: STEEL_EDGE, width: 0.5, join: "round" }}
    />
    <Shape geometry={circle(gear.r * 0.3)} anchor="center" fill={STEEL_EDGE} />
  </Group>
);

const Shade = ({ c, r }: { readonly c: Vec; readonly r: number }): SceneElement => (
  <Shape
    geometry={circle(r * 0.94)}
    at={add(c, [2.5, 4])}
    anchor="center"
    stroke={{ color: "#00000052", width: r * 0.14 }}
  />
);

const Jewel = ({ c, r = 4.2 }: { readonly c: Vec; readonly r?: number }): SceneElement => (
  <Group at={c}>
    <Shape
      geometry={circle(r)}
      anchor="center"
      fill={RUBY}
      stroke={{ color: RUBY_EDGE, width: 0.5 }}
    />
    <Shape geometry={circle(r * 0.36)} anchor="center" fill={STEEL} />
  </Group>
);

const Pin = ({ c }: { readonly c: Vec }): SceneElement => (
  <Shape
    geometry={circle(2.2)}
    at={c}
    anchor="center"
    fill={STEEL}
    stroke={{ color: STEEL_EDGE, width: 0.4 }}
  />
);

const escapeWheel = (() => {
  const [toe, heel, backOf, neckBack, rootBack, rootFront, neckFront] = tooth;
  const at = (q: P, k: number): string => pt(turn(q, k * PITCH), 2);
  let d = "";

  for (let k = 0; k < TEETH; k++)
    d +=
      (k ? "L" : "M") +
      [rootBack, neckBack, backOf, heel, toe, neckFront, rootFront].map((q) => at(q, k)).join("L") +
      "A42 42 0 0 1 " +
      at(rootBack, k + 1);

  return pierced(d + "Z", windows(8.5, 36.5, 5, 4.2, 0, 2));
})();

const SLICES = 10;
const COILS = 8.5;

const hairspring = Array.from({ length: SLICES + 1 }, (_, j) => {
  const pad = (SWING / SLICES / 2 / (360 * COILS)) * 1.1;
  const u0 = Math.max(0, (j - 0.5) / SLICES - pad);
  const u1 = Math.min(1, (j + 0.5) / SLICES + pad);
  const radius = (u: number): number => 41 - 32 * u;
  const angle = (u: number): number => 62 + 360 * COILS * u;

  return (
    <Group at={STAFF} origin="at" rotate={theta.map((v) => (v * j) / SLICES)}>
      <Shape
        geometry={pathData(spiral(radius(u0), radius(u1), angle(u0), angle(u1), 2))}
        stroke={{ color: "#6F8FE8", width: 0.8, cap: "round" }}
      />
    </Group>
  );
});

const balanceWheel = subtract(circle(88), ...windows(9, 77, 3, 7, 30, 2).map(pathData));

const fork = (() => {
  const top = -(REACH - PIN);
  const q = (x: number, y: number): string => pt([x, y], 2);

  const lever = pathData(
    "M" +
      [
        q(-4.6, 0),
        q(-2.6, top + 16),
        q(-7.4, top + 5),
        q(-7.4, top - 4.5),
        q(-2.5, top - 4.5),
        q(-2.5, top + 3.2),
        q(2.5, top + 3.2),
        q(2.5, top - 4.5),
        q(7.4, top - 4.5),
        q(7.4, top + 5),
        q(2.6, top + 16),
        q(4.6, 0),
      ].join("L") +
      "Z",
  );

  const local = (p: P): P => [p[0] - FORK[0], p[1] - FORK[1]];
  const mid = (s: typeof entry): P => local([(s[2][0] + s[3][0]) / 2, (s[2][1] + s[3][1]) / 2]);

  const anchor = pathData(
    "M" +
      q(...mid(entry)) +
      "Q" +
      q(-14, -3) +
      " " +
      q(0, 0) +
      "Q" +
      q(14, -3) +
      " " +
      q(...mid(exitStone)),
  );

  const stone = (s: readonly P[]) => pathData("M" + s.map((p) => pt(local(p), 2)).join("L") + "Z");

  return { lever, anchor, entry: stone(entry), exit: stone(exitStone) };
})();

const arm = symbol(() => (
  <Shape
    geometry={pathData(spiral(100, 34, 0, 200))}
    stroke={{ color: "#8C96A8", width: 4.2, cap: "round" }}
  />
));

interface View {
  readonly center: Vec;
  readonly size: number;
}

const view = (x: number, y: number, size: number): View => ({ center: [x, y], size });
const WIDE = view(487, 505, 790);

const [, ...moves] = span(0, 4).chain(5, 5, 5, 5, 5, 5, 4, 4, 4, 5, 6);

const tour = {
  barrel: { move: moves[0], view: view(424, 556, 560) },
  train: { move: moves[2], view: view(646, 612, 430) },
  escapement: { move: moves[4], view: view(768, 398, 350) },
  pin: { move: moves[6], view: view(761, 352, 120) },
  stones: { move: moves[8], view: view(761, 432, 140) },
  close: { move: moves[10], view: WIDE },
};

type Stop = keyof typeof tour;

const order: readonly Stop[] = ["barrel", "train", "escapement", "pin", "stones", "close"];

const zoom = (v: View): number => SIZE / v.size;

const shift = (v: View): Vec => [
  SIZE / 2 - zoom(v) * v.center[0],
  SIZE / 2 - zoom(v) * v.center[1],
];

const camera = order.reduce(
  (cam, stop) => ({
    scale: cam.scale.to(zoom(tour[stop].view), tour[stop].move, ease.inOut),
    at: cam.at.to(shift(tour[stop].view), tour[stop].move, ease.inOut),
  }),
  { scale: track(zoom(WIDE)), at: track(shift(WIDE)) },
);

const held = (stop: Stop, lead = 1) => {
  const next = order[order.indexOf(stop) + 1];
  const end = next ? tour[next].move.start : D;

  return span(tour[stop].move.end - lead).until(end + 0.4);
};

interface Note {
  readonly name: string;
  readonly note?: string;
  readonly at: Vec;
  readonly to: Vec;
  readonly stop: Stop;
  readonly after?: number;
  readonly end?: boolean;
}

const Label = ({ name, note, at: [x, y], to, stop, after = 0, end }: Note): SceneElement => {
  const shown = held(stop).shift(after);
  const size = (tour[stop].view.size / SIZE) * 30;
  const wide = mono.measure(name, size);
  const far = end ? to[0] < x - wide / 2 : to[0] > x + wide / 2;
  const under = note !== undefined && to[1] > y + size * 1.6;
  const side = end ? -1 : 1;

  const tail: Vec = under
    ? [x + side * size * 0.4, y + size * 1.6]
    : [x + side * (far ? wide + size * 0.35 : -size * 0.35), y - size * 0.32];

  return (
    <Group motion={[enter(shown.first(0.8)), exit(span(shown.end, 0.8))]}>
      <Shape
        geometry={line(tail, to)}
        stroke={{ color: "#ECE9E2B3", width: size * 0.05 }}
        trim={draw(span(shown.start + 0.2, 1))}
      />
      <Shape geometry={circle(size * 0.14)} at={to} anchor="center" fill={INK} />
      <Text
        font={mono}
        size={Number(n(size, 2))}
        at={[x, y]}
        anchor={end ? "baseline-right" : "baseline-left"}
        fill={INK}
      >
        {name}
      </Text>
      {note !== undefined && (
        <Text
          font={mono}
          size={Number(n(size * 0.8, 2))}
          at={[x, y + size * 1.2]}
          anchor={end ? "baseline-right" : "baseline-left"}
          fill={DIM}
        >
          {note}
        </Text>
      )}
    </Group>
  );
};

const at = (c: Vec, r: number, deg: number): Vec => add(c, polar(r, deg));

const notes: readonly Note[] = [
  {
    name: "Barrel",
    note: "54 teeth",
    at: [166, 318],
    to: at(barrel.c, barrel.r + 6, -22),
    stop: "barrel",
  },
  {
    name: "Centre wheel",
    note: "48 teeth",
    at: [470, 310],
    to: at(center.c, center.r + 3, 22),
    stop: "barrel",
    after: 0.6,
  },
  {
    name: "Third wheel",
    note: "48 teeth",
    at: [446, 786],
    to: at(third.c, third.r + 3, 205),
    stop: "train",
  },
  {
    name: "Fourth wheel",
    note: "32 teeth",
    at: [846, 760],
    to: at(fourth.c, fourth.r + 3, 140),
    stop: "train",
    after: 0.6,
    end: true,
  },
  {
    name: "Balance",
    note: "5 beats a second",
    at: [606, 238],
    to: at(STAFF, 88, -75),
    stop: "escapement",
  },
  {
    name: "Pallet fork",
    at: [606, 388],
    to: add(PIVOT, [-5, -30]),
    stop: "escapement",
    after: 0.5,
  },
  {
    name: "Escape wheel",
    note: "1 turn in 6 s",
    at: [930, 500],
    to: at(ESCAPE, 57, 84),
    stop: "escapement",
    after: 1,
    end: true,
  },
  { name: "Fork", at: [707, 400], to: add(PIVOT, [-4, -44]), stop: "pin" },
  {
    name: "Banking pin",
    at: [815, 400],
    to: add(PIVOT, [10.4, -29]),
    stop: "pin",
    after: 0.5,
    end: true,
  },
  {
    name: "Entry stone",
    at: [697, 386],
    to: add(ESCAPE, add(entry[3], [-0.5, 2])),
    stop: "stones",
  },
  {
    name: "Exit stone",
    at: [825, 386],
    to: add(ESCAPE, add(exitStone[2], [0.5, 1])),
    stop: "stones",
    after: 0.5,
    end: true,
  },
];

const Train = ({
  gear,
  pinion,
  by,
  spokes,
  fill,
}: {
  readonly gear: Gear;
  readonly pinion: Gear;
  readonly by: number;
  readonly spokes: number;
  readonly fill: Paint;
}): SceneElement => (
  <Group>
    <Shade c={gear.c} r={gear.r} />
    <Axle gear={gear} by={by}>
      <Pinion gear={{ ...pinion, c: [0, 0] }} />
      <Wheel gear={{ ...gear, c: [0, 0] }} spokes={spokes} fill={fill} />
      <Bevel gear={gear} />
    </Axle>
  </Group>
);

export default scene(
  {
    size: [SIZE, SIZE],
    duration: D,
    title: "A watch movement running, from the barrel to the escapement",
    desc: "A mechanical watch movement runs ten times slower than life: the balance swings, its pin throws the pallet fork from side to side, and the escape wheel steps a tooth at a time, turning the fourth and third wheels behind it. The view travels from the mainspring barrel down the train to the escapement, closes in on the impulse pin and then on the two ruby stones, and pulls back.",
    reducedMotion: 31,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={GROUND} />
      <Group at={camera.at} scale={camera.scale} origin="at">
        <Axle gear={escapePinion} by={1}>
          <Pinion gear={{ ...escapePinion, c: [0, 0] }} />
        </Axle>
        <Train gear={fourth} pinion={fourthPinion} by={fourthBy} spokes={6} fill={GILT} />
        <Train gear={third} pinion={thirdPinion} by={thirdBy} spokes={4} fill={BRASS} />
        <Train gear={center} pinion={centerPinion} by={centerBy} spokes={6} fill={GILT} />
        <Shade c={barrel.c} r={barrel.r} />
        <Axle gear={barrel} by={barrelBy}>
          <Shape
            geometry={pathData(teethOf({ ...barrel, c: [0, 0] }))}
            fill={BRASS}
            stroke={{ color: BRASS_EDGE, width: 0.6, join: "round" }}
          />
          <Shape
            geometry={circle(barrel.r * 0.88)}
            anchor="center"
            fill="#17191E"
            stroke={{ color: BRASS_EDGE, width: 1 }}
          />
          {Array.from({ length: 9 }, (_, i) => (
            <Instance of={arm} rotate={i * 40} origin="at" />
          ))}
          <Shape
            geometry={circle(24)}
            anchor="center"
            fill={STEEL}
            stroke={{ color: STEEL_EDGE, width: 0.8 }}
          />
          <Shape geometry={circle(8)} anchor="center" fill={STEEL_EDGE} />
        </Axle>
        <Shade c={ESCAPE} r={60 / 0.94 / 1.9} />
        <Axle gear={escapePinion} by={1}>
          <Shape
            geometry={escapeWheel}
            rotate={WHEEL0 + wheelAt(BEAT0)}
            origin="at"
            fill={STEEL}
            stroke={{ color: STEEL_EDGE, width: 0.4, join: "round" }}
          />
        </Axle>
        <Jewel c={third.c} />
        <Jewel c={fourth.c} />
        <Group at={STAFF} origin="at" rotate={theta}>
          <Shape geometry={balanceWheel} fill={GILT} stroke={{ color: BRASS_EDGE, width: 0.5 }} />
        </Group>
        {hairspring}
        <Pin c={at(STAFF, 41, 62)} />
        <Pin c={add(PIVOT, [-8.6, -30])} />
        <Pin c={add(PIVOT, [8.6, -30])} />
        <Group at={PIVOT} origin="at" rotate={rocking}>
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
        <Jewel c={PIVOT} r={3.4} />
        <Jewel c={ESCAPE} r={3.4} />
        <Group at={STAFF} origin="at" rotate={theta}>
          <Shape
            geometry={circle(PIN + 4.5)}
            anchor="center"
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
        <Jewel c={STAFF} r={5} />
        {notes.map((note) => (
          <Label {...note} />
        ))}
      </Group>
    </Group>
  ),
);
