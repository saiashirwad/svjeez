import { SceneError } from "svjeez/tools";
import type { Vec } from "svjeez";

export interface Segment {
  readonly to: Vec;
  readonly via?: readonly [Vec, Vec];
}

export interface Ring {
  readonly start: Vec;
  readonly segments: readonly Segment[];
}

const ARITY = new Map([
  ["M", 2],
  ["L", 2],
  ["H", 1],
  ["V", 1],
  ["Q", 4],
  ["T", 2],
  ["C", 6],
  ["S", 4],
  ["Z", 0],
]);

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const quad = (from: Vec, control: Vec, to: Vec): Segment => ({
  to,
  via: [lerp(from, control, 2 / 3), lerp(to, control, 2 / 3)],
});

const mirror = (point: Vec, around: Vec): Vec => [
  2 * around[0] - point[0],
  2 * around[1] - point[1],
];

export function parsePath(d: string, quoted: string): Ring[] {
  const rings: Ring[] = [];
  let open: { start: Vec; segments: Segment[] } | undefined;
  let pen: Vec = [0, 0];
  let lastQuad: Vec | undefined;
  let lastCubic: Vec | undefined;

  const add = (segment: Segment) => {
    if (!open) open = { start: pen, segments: [] };
    open.segments.push(segment);
    pen = segment.to;
  };

  const close = () => {
    if (open && open.segments.length > 0) rings.push(open);
    open = undefined;
  };

  for (const [, command, body] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const arity = ARITY.get(command!);

    if (arity === undefined)
      throw new SceneError(`<Tex> can't read the outline of a symbol in ${quoted}.`);
    const n = (body!.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

    if (arity === 0) {
      close();
      continue;
    }

    for (let i = 0; i < n.length; i += arity) {
      const at = (k: number): Vec => [n[i + k]!, n[i + k + 1]!];
      let [nextQuad, nextCubic]: [Vec | undefined, Vec | undefined] = [undefined, undefined];

      if (command === "M" && i === 0) {
        close();
        pen = at(0);
      } else if (command === "M") add({ to: at(0) });
      else if (command === "L") add({ to: at(0) });
      else if (command === "H") add({ to: [n[i]!, pen[1]] });
      else if (command === "V") add({ to: [pen[0], n[i]!] });
      else if (command === "Q") {
        nextQuad = at(0);
        add(quad(pen, at(0), at(2)));
      } else if (command === "T") {
        nextQuad = lastQuad ? mirror(lastQuad, pen) : pen;
        add(quad(pen, nextQuad, at(0)));
      } else if (command === "C") {
        nextCubic = at(2);
        add({ to: at(4), via: [at(0), at(2)] });
      } else {
        nextCubic = at(0);
        add({ to: at(2), via: [lastCubic ? mirror(lastCubic, pen) : pen, at(0)] });
      }

      [lastQuad, lastCubic] = [nextQuad, nextCubic];
    }
  }

  close();

  return rings;
}

export const mapRing = (ring: Ring, f: (point: Vec) => Vec): Ring => ({
  start: f(ring.start),
  segments: ring.segments.map(({ to, via }) => ({
    to: f(to),
    ...(via && { via: [f(via[0]), f(via[1])] as const }),
  })),
});

export const boxRing = (x: number, y: number, w: number, h: number): Ring => ({
  start: [x, y],
  segments: [{ to: [x + w, y] }, { to: [x + w, y + h] }, { to: [x, y + h] }, { to: [x, y] }],
});

export const reversed = (ring: Ring): Ring => {
  const points = [ring.start, ...ring.segments.map((s) => s.to)].reverse();

  return {
    start: points[0]!,
    segments: ring.segments
      .slice()
      .reverse()
      .map((s, i) => ({
        to: points[i + 1]!,
        ...(s.via && { via: [s.via[1], s.via[0]] as const }),
      })),
  };
};

export const pointsOf = (ring: Ring): Vec[] => [
  ring.start,
  ...ring.segments.flatMap((s) => (s.via ? [s.via[0], s.via[1], s.to] : [s.to])),
];
