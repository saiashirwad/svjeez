// Easing and color math for the panel's handles.
import type { Hex } from "svjeez";

export const bez = (p: readonly number[]) => {
  const [x1, y1, x2, y2] = [p[0]!, p[1]!, p[2]!, p[3]!];
  const cx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const cy = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;

  return (u: number) => {
    let lo = 0;
    let hi = 1;

    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;

      if (cx(mid) < u) lo = mid;
      else hi = mid;
    }

    return cy((lo + hi) / 2);
  };
};

export const curvePath = (
  p: readonly number[],
  X: (u: number) => number,
  Y: (v: number) => number,
) => {
  const f = bez(p);
  let d = "";

  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    d += `${k ? "L" : "M"}${X(u).toFixed(2)} ${Y(f(u)).toFixed(2)}`;
  }

  return d;
};

export const fmt = (n: number, d: number) => String(Number(n.toFixed(d)));

// ----- color math (HSL is enough for a sketch)

export const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;

  return [h * 60, s, l];
};

export const hslToHex = (h: number, s: number, l: number): Hex => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));

    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${`${f(0)}${f(8)}${f(4)}`.toUpperCase()}`;
};
