import type { Ease } from "./motion";

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
