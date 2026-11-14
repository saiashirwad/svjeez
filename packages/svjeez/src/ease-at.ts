import { ease, type Ease } from "./motion";

const cubic = (a: number, b: number, u: number) =>
  3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;

/**
 * How far along `curve` is at `progress` (0 to 1), the value the browser would draw there. A `pop` returns more than
 * 1 while it overshoots. Use it to reuse an ease inside `sampled()`, or to draw the curve beside the scene.
 */
export const easeAt = (curve: Ease, progress: number): number => {
  const x = Math.min(1, Math.max(0, progress));

  switch (curve.kind) {
    case "linear":
      return x;
    case "steps":
      return Math.floor(x * curve.count) / curve.count;
    case "bezier": {
      const [x1, y1, x2, y2] = curve.points;
      let lo = 0;
      let hi = 1;

      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;

        if (cubic(x1, x2, mid) < x) lo = mid;
        else hi = mid;
      }

      return cubic(y1, y2, (lo + hi) / 2);
    }
  }
};

type Pair = readonly [number, number];

const mix = (a: Pair, b: Pair, s: number): Pair => [
  a[0] + (b[0] - a[0]) * s,
  a[1] + (b[1] - a[1]) * s,
];

const unit = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * The two eases that, played back to back over the two parts of a transition cut at `progress`, draw what `curve` draws
 * over the whole. Each runs from 0 to 1 over its own part. A `steps()` can be cut only on a step edge. `where` starts
 * the error when it cannot.
 */
export const splitEase = (curve: Ease, progress: number, where: string): readonly [Ease, Ease] => {
  switch (curve.kind) {
    case "linear":
      return [curve, curve];
    case "steps": {
      const edge = progress * curve.count;
      const done = Math.round(edge);

      if (Math.abs(edge - done) > 1e-6 || done < 1 || done >= curve.count)
        throw new Error(
          `${where} cuts a steps(${curve.count}) transition between two of its steps. Cut it on a step edge, or use ease.out.`,
        );

      return [ease.steps(done), ease.steps(curve.count - done)];
    }

    case "bezier": {
      const [x1, y1, x2, y2] = curve.points;
      let lo = 0;
      let hi = 1;

      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;

        if (cubic(x1, x2, mid) < progress) lo = mid;
        else hi = mid;
      }

      const s = (lo + hi) / 2;

      const [p0, p1, p2, p3]: [Pair, Pair, Pair, Pair] = [
        [0, 0],
        [x1, y1],
        [x2, y2],
        [1, 1],
      ];

      const [a, b, c] = [mix(p0, p1, s), mix(p1, p2, s), mix(p2, p3, s)];
      const [d, e] = [mix(a, b, s), mix(b, c, s)];
      const f = mix(d, e, s);
      const rise = f[1];
      const rest = 1 - f[1];

      const head =
        Math.abs(rise) < 1e-6
          ? ease.linear
          : ease.bezier(unit(a[0] / f[0]), a[1] / rise, unit(d[0] / f[0]), d[1] / rise);

      const tail =
        Math.abs(rest) < 1e-6
          ? ease.linear
          : ease.bezier(
              unit((e[0] - f[0]) / (1 - f[0])),
              (e[1] - f[1]) / rest,
              unit((c[0] - f[0]) / (1 - f[0])),
              (c[1] - f[1]) / rest,
            );

      return [head, tail];
    }
  }
};
