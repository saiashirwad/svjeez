export type Point = readonly [x: number, y: number];

/** One circle of the chain: it turns k times per loop, with radius r and starting angle phase, in units where the outline spans [-1, 1]. */
export interface Term {
  readonly k: number;
  readonly r: number;
  readonly phase: number;
}

/** A closed outline taken apart into circles, largest first, and the outline itself in the same units. */
export interface Spectrum {
  readonly terms: readonly Term[];
  readonly outline: readonly Point[];
}

export const SAMPLES = 512;
export const MAX_TERMS = SAMPLES - 1;

/** `count` points evenly spaced by arc length around a closed polyline. */
const resample = (points: readonly Point[], count: number): Point[] => {
  const closed = [...points, points[0]!];
  const cumulative = [0];

  for (let i = 1; i < closed.length; i++)
    cumulative.push(cumulative[i - 1]! + Math.hypot(closed[i]![0] - closed[i - 1]![0], closed[i]![1] - closed[i - 1]![1]));
  const total = cumulative.at(-1)!;
  let j = 1;

  return Array.from({ length: count }, (_, i) => {
    const at = (total * i) / count;

    while (j < closed.length - 1 && cumulative[j]! < at) j++;
    const span = cumulative[j]! - cumulative[j - 1]!;
    const u = span > 0 ? (at - cumulative[j - 1]!) / span : 0;
    const [a, b] = [closed[j - 1]!, closed[j]!];

    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  });
};

/** Centers the outline on its mean, flips y up, and scales its longer side to 2, so c0 is zero and the radii read as fractions of the drawing. */
const normalize = (points: readonly Point[]): Point[] => {
  const n = points.length;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;

  return points.map(([x, y]) => [(x - mx) / half, -(y - my) / half]);
};

/** The discrete Fourier transform of the outline, z(t) = sum of r e^{i(kt + phase)}, every term but c0, largest first. */
export const spectrum = (drawn: readonly Point[]): Spectrum => {
  const outline = normalize(resample(drawn, SAMPLES));
  const n = SAMPLES;
  const terms: Term[] = [];

  for (let k = -n / 2 + 1; k <= n / 2; k++) {
    if (k === 0) continue;
    let re = 0;
    let im = 0;

    outline.forEach(([x, y], m) => {
      const a = (-2 * Math.PI * k * m) / n;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      re += x * c - y * s;
      im += x * s + y * c;
    });
    terms.push({ k, r: Math.hypot(re, im) / n, phase: Math.atan2(im, re) });
  }

  terms.sort((a, b) => b.r - a.r || Math.abs(a.k) - Math.abs(b.k));

  return { terms, outline };
};
