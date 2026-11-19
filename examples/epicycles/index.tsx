import { google } from "@svjeez/fonts";
import {
  Group,
  Shape,
  circle,
  ease,
  enter,
  exit,
  line,
  polygon,
  sampled,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { theme } from "../theme";

const SIZE: Vec = [960, 540];
const TERMS = 80;
const CIRCLES = 28;
const SAMPLES = 1024;
const TRACE = 400;
const HEIGHT = 360;

const merriweather = await google("Merriweather", { italic: true });

const outline = (d: string): Vec[] => {
  const points: Vec[] = [];
  let pen: Vec = [0, 0];

  for (const [, command, body] of d.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
    const n = (body!.match(/-?[\d.]+/g) ?? []).map(Number);

    if (command === "Q") {
      const c: Vec = [n[0]!, n[1]!];
      const to: Vec = [n[2]!, n[3]!];

      for (let i = 1; i <= 8; i++) {
        const u = i / 8;
        const v = 1 - u;
        points.push([
          v * v * pen[0] + 2 * u * v * c[0] + u * u * to[0],
          v * v * pen[1] + 2 * u * v * c[1] + u * u * to[1],
        ]);
      }

      pen = to;
    } else if (command !== "Z") {
      pen = [n[0]!, n[1]!];
      points.push(pen);
    }
  }

  return points;
};

const lengths = (points: readonly Vec[]): number[] =>
  points.reduce<number[]>(
    (sum, p, i) =>
      i === 0
        ? [0]
        : [...sum, sum[i - 1]! + Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1])],
    [],
  );

const resample = (points: readonly Vec[], count: number): Vec[] => {
  const loop = [...points, points[0]!];
  const along = lengths(loop);
  const total = along.at(-1)!;
  let j = 1;

  return Array.from({ length: count }, (_, i) => {
    const at = (total * i) / count;

    while (along[j]! < at) j++;
    const u = (at - along[j - 1]!) / (along[j]! - along[j - 1]! || 1);

    return [
      loop[j - 1]![0] + (loop[j]![0] - loop[j - 1]![0]) * u,
      loop[j - 1]![1] + (loop[j]![1] - loop[j - 1]![1]) * u,
    ];
  });
};

interface Term {
  readonly k: number;
  readonly r: number;
  readonly phase: number;
}

const spectrum = (points: readonly Vec[]) => {
  const n = points.length;
  const all: Term[] = [];
  let mean: Vec = [0, 0];

  for (let k = -n / 2 + 1; k <= n / 2; k++) {
    let [re, im] = [0, 0];

    points.forEach(([x, y], i) => {
      const a = (-2 * Math.PI * k * i) / n;
      re += x * Math.cos(a) - y * Math.sin(a);
      im += x * Math.sin(a) + y * Math.cos(a);
    });

    if (k === 0) mean = [re / n, im / n];
    else all.push({ k, r: Math.hypot(re, im) / n, phase: Math.atan2(im, re) });
  }

  return { mean, terms: all.sort((a, b) => b.r - a.r).slice(0, TERMS) };
};

const glyph = outline(merriweather.path("π", { size: 1 }).d);
const xs = glyph.map(([x]) => x);
const ys = glyph.map(([, y]) => y);

const scale =
  HEIGHT / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

const mid: Vec = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];

const placed = resample(
  glyph.map(([x, y]): Vec => [
    (x - mid[0]) * scale + SIZE[0] / 2,
    (y - mid[1]) * scale + SIZE[1] / 2,
  ]),
  SAMPLES,
);

const { mean, terms } = spectrum(placed);

const tenth = (v: number): number => Math.round(v * 10) / 10;

const pen = (s: number): Vec =>
  terms.reduce<Vec>(
    ([x, y], { k, r, phase }) => [
      x + r * Math.cos(2 * Math.PI * k * s + phase),
      y + r * Math.sin(2 * Math.PI * k * s + phase),
    ],
    mean,
  );

const trace = Array.from({ length: TRACE }, (_, j): Vec => {
  const [x, y] = pen(j / TRACE);

  return [tenth(x), tenth(y)];
});

const along = lengths([...trace, trace[0]!]);
const total = along.at(-1)!;

const drawing = span(0.8, 10);
const [shown, fill, gone] = [span(drawing.start, 0.5), drawing.next(0.6), drawing.next(0.6, 2)];

const drawn = (t: number): number => {
  const u = Math.min(1, t / drawing.over) * TRACE;
  const j = Math.min(TRACE - 1, Math.floor(u));

  return (along[j]! + (along[j + 1]! - along[j]!) * (u - j)) / total;
};

const ring = { color: theme.blue, width: 1 };

const Chain = ({ from }: { readonly from: number }): SceneElement => {
  const { k, r, phase } = terms[from]!;
  const before = terms[from - 1];
  const arm: Vec = [tenth(r * Math.cos(phase)), tenth(r * Math.sin(phase))];

  const at: Vec = before
    ? [tenth(before.r * Math.cos(before.phase)), tenth(before.r * Math.sin(before.phase))]
    : [tenth(mean[0]), tenth(mean[1])];

  return (
    <Group
      offset={at}
      origin="at"
      rotate={track(0).to(360 * (k - (before?.k ?? 0)), drawing, ease.linear)}
    >
      {from < CIRCLES && <Shape geometry={circle(tenth(r))} stroke={ring} opacity={0.4} />}
      {from < CIRCLES && (
        <Shape geometry={line([0, 0], arm)} stroke={{ ...ring, width: 1.25 }} opacity={0.8} />
      )}
      {from + 1 < terms.length ? (
        <Chain from={from + 1} />
      ) : (
        <Shape geometry={circle(4)} at={arm} anchor="center" fill={theme.orange} />
      )}
    </Group>
  );
};

export default scene(
  {
    size: SIZE,
    duration: 14,
    title: "Epicycles",
    desc: "Circles spinning on the tips of circles trace the letter pi, the largest first, and the letter fills in.",
    theme,
    still: 12,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group motion={exit(gone)}>
        <Shape geometry={polygon(...trace)} fill={theme.blue} opacity={track(0).to(1, fill)} />
        <Shape
          geometry={polygon(...trace)}
          stroke={{ color: theme.orange, width: 2, join: "round", cap: "round" }}
          trim={sampled((t): Vec => [0, drawn(t)], drawing, { tolerance: 0.002 })}
        />
      </Group>
      <Group motion={[enter(shown), exit(fill)]}>
        <Chain from={0} />
      </Group>
    </Group>
  ),
);
