// What the lab draws from a flight: legend colors, wording, the overlay's trails and dots, the timeline's speed hills
// and the scene source split into highlighted lines.
import { linesOf, literalAt, parse, type Piece } from "@svjeez/live/source";
import type { Spline } from "svjeez";
import { clamp } from "../util";
import { curve, DURATION, end, INITIAL, isFlight, route, type Flight } from "./flight";

export const LEG_COLORS = ["#FF6B5B", "#F5A524", "#17B890", "#7C6CF2", "#E255A1", "#2E9BF0"];
export const legColor = (i: number) => LEG_COLORS[i % LEG_COLORS.length]!;

export const GHOST_STEP = 1 / 12;
export const SPEED_STEPS = 24;

export const round = (n: number, step: number) => Math.round(n / step) * step;
export const fmt = (t: number) => `${t.toFixed(2)}s`;
export const pct = (t: number) => `${(t / DURATION) * 100}%`;
export const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`);

export const feelWords = (f: number) =>
  Math.abs(f) < 0.08
    ? "steady"
    : f > 0
      ? f > 0.6
        ? "darts off, floats in"
        : "leaves fast, lands slow"
      : f < -0.6
        ? "creeps, then dives"
        : "leaves slow, lands fast";

/** The moments the overlay drops a dot at, along the whole flight. */
export const ghostTimes = (flight: Flight) => {
  const out: number[] = [];

  for (let t = flight.launch; t <= end(flight) + 1e-6; t += GHOST_STEP) out.push(t);

  return out;
};

export const trailPath = (path: Spline, leg: number) => path.path(leg, leg + 1);

/** How fast the plane moves through the leg, sampled across its duration. */
const speedProfile = (flight: Flight, i: number) => {
  const path = route(flight);
  const leg = flight.legs[i]!;

  return Array.from({ length: SPEED_STEPS + 1 }, (_, k) => {
    const s = clamp(k / SPEED_STEPS, 0.001, 0.999);

    const du =
      (curve(Math.min(1, s + 0.001), leg.feel) - curve(Math.max(0, s - 0.001), leg.feel)) / 0.002;

    const { x, y } = path.tangent(i + curve(s, leg.feel));

    return (Math.hypot(x, y) * du) / leg.over;
  });
};

/** One filled hill per leg, in a 100 by 40 box, all scaled to the tallest speed. */
export const speedHills = (flight: Flight) => {
  const profiles = flight.legs.map((_, i) => speedProfile(flight, i));
  const top = Math.max(...profiles.flat(), 1);

  return profiles.map((profile) => {
    const area = profile
      .map((v, k) => `${((k / SPEED_STEPS) * 100).toFixed(1)} ${(40 - (v / top) * 32).toFixed(1)}`)
      .join(" L");

    return `M0 40 L${area} L100 40Z`;
  });
};

export interface CodeLine {
  readonly pieces: readonly Piece[];
  /** The index of the leg this line spells out, for the colored bar and the hover highlight. */
  readonly leg: number | undefined;
}

/** The scene source as highlighted lines, with the values the lab edits as pieces of their own. */
export const codeLines = (source: string): CodeLine[] => {
  const scene = parse(source);

  const legs = new Map(
    INITIAL.legs.map((_, i) => [scene.lineAt(literalAt(scene, ["legs", i, "over"])!.range[0]), i]),
  );

  return linesOf(scene, (l) => isFlight(l.path)).map(({ n, pieces }) => ({
    pieces,
    leg: legs.get(n),
  }));
};
