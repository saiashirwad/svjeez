// The flight the lab edits, read from and written back into the scene source, and the same math the source runs.
import { apply, literalAt, parse, write, type Edit, type PathStep } from "@svjeez/live/source";
import { spline } from "svjeez";
import plane from "./plane.tsx?raw";

export type Pt = readonly [number, number];

export interface Leg {
  readonly to: Pt;
  readonly over: number;
  readonly feel: number;
}

export interface Flight {
  readonly launch: number;
  readonly from: Pt;
  readonly legs: readonly Leg[];
}

export const WIDTH = 640;
export const HEIGHT = 300;

const scene = parse(plane);

const numberAt = (path: readonly PathStep[]) => {
  const literal = literalAt(scene, path);

  if (literal?.kind !== "number") throw new Error(`plane.tsx has no number at ${path.join(".")}.`);

  return literal;
};

const pointAt = (path: readonly PathStep[]): Pt => [
  numberAt([...path, 0]).value,
  numberAt([...path, 1]).value,
];

export const DURATION = numberAt(["duration"]).value;

/** The flight must land by then, so reactions and puffs finish inside the loop. */
export const LATEST_END = DURATION - 1.2;
export const MIN_OVER = 0.25;

/** The flight plane.tsx is written with. */
export const INITIAL: Flight = {
  launch: numberAt(["launch"]).value,
  from: pointAt(["from"]),
  legs: scene.literals
    .filter((l) => l.path?.[0] === "legs" && l.path[2] === "over")
    .map((_, i) => ({
      to: pointAt(["legs", i, "to"]),
      over: numberAt(["legs", i, "over"]).value,
      feel: numberAt(["legs", i, "feel"]).value,
    })),
};

/** plane.tsx with `flight` written into it, and every other byte as the file has it. */
export const sourceOf = (flight: Flight): string => {
  const edits: Edit[] = [];

  const put = (path: readonly PathStep[], value: number, digits: number) => {
    const literal = numberAt(path);
    edits.push({ range: literal.range, text: write({ ...literal, value }, digits) });
  };

  const point = (path: readonly PathStep[], [x, y]: Pt) => {
    put([...path, 0], x, 0);
    put([...path, 1], y, 0);
  };

  put(["launch"], flight.launch, 2);
  point(["from"], flight.from);
  flight.legs.forEach((leg, i) => {
    point(["legs", i, "to"], leg.to);
    put(["legs", i, "over"], leg.over, 2);
    put(["legs", i, "feel"], leg.feel, 2);
  });

  return apply(plane, edits);
};

/** Whether a literal at `path` is one the lab edits: the launch, the start or a leg. */
export const isFlight = (path: readonly PathStep[] | undefined) =>
  path?.[0] === "launch" || path?.[0] === "from" || path?.[0] === "legs";

export const curve = (u: number, f: number) =>
  f < 0 ? u ** (1 - 3 * f) : 1 - (1 - u) ** (1 + 3 * f);

export const points = (flight: Flight): Pt[] => [flight.from, ...flight.legs.map((leg) => leg.to)];

/** The smooth route through the points: leg i runs from position i to i + 1. */
export const route = (flight: Flight) => spline(points(flight).map(([x, y]) => ({ x, y })));

export const starts = (flight: Flight) => {
  let start = flight.launch;

  return flight.legs.map((leg) => {
    const s = start;
    start += leg.over;

    return s;
  });
};

export const end = (flight: Flight) =>
  flight.launch + flight.legs.reduce((sum, leg) => sum + leg.over, 0);

export const fly = (flight: Flight, t: number) => {
  const path = route(flight);
  let start = flight.launch;
  let i = 0;

  while (i < flight.legs.length - 1 && t > start + flight.legs[i]!.over)
    start += flight.legs[i++]!.over;
  const leg = flight.legs[i]!;
  const s = Math.min(1, Math.max(0, (t - start) / leg.over));
  const u = curve(s, leg.feel);
  const { x, y } = path.point(i + u);

  return { x, y, rotate: path.angle(i + u), leg: i, s, u };
};

export const when = (flight: Flight, x: number) => {
  for (let t = 0; t < DURATION - 2; t += 0.02) if (fly(flight, t).x >= x) return t;

  return undefined;
};
