import type { Vec3 } from "./space";

export interface P2 {
  readonly x: number;
  readonly y: number;
}

const n = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;

  return Object.is(rounded, -0) ? "0" : String(rounded);
};

export const xy = ({ x, y }: P2): string => `${n(x)} ${n(y)}`;
export const mid = (a: P2, b: P2): P2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const polygon = (points: readonly P2[]): string => `M${points.map(xy).join("L")}Z`;

export const smooth = (points: readonly P2[], closed = false): string => {
  if (points.length < 2) return "";

  if (closed) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let d = `M${xy(mid(last, first))}`;
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length]!;
      d += `Q${xy(point)} ${xy(mid(point, next))}`;
    });

    return `${d}Z`;
  }

  let d = `M${xy(points[0]!)}`;

  for (let i = 1; i < points.length - 1; i++)
    d += `Q${xy(points[i]!)} ${xy(mid(points[i]!, points[i + 1]!))}`;

  return `${d}L${xy(points[points.length - 1]!)}`;
};

export const tapered = (points: readonly P2[], widths: readonly number[]): string => {
  const left: P2[] = [];
  const right: P2[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const half = (widths[i] ?? 0) / 2;
    left.push({ x: point.x + nx * half, y: point.y + ny * half });
    right.push({ x: point.x - nx * half, y: point.y - ny * half });
  }

  return smooth([...left, ...right.reverse()], true);
};

export const edge = (
  points: readonly P2[],
  widths: readonly number[],
  offset: number,
  width: number,
): string => {
  const left: P2[] = [];
  const right: P2[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const rake = (widths[i] ?? 0) * offset;
    const half = (widths[i] ?? 0) * width;
    left.push({ x: point.x + nx * (rake + half), y: point.y + ny * (rake + half) });
    right.push({ x: point.x + nx * (rake - half), y: point.y + ny * (rake - half) });
  }

  return smooth([...left, ...right.reverse()], true);
};

export const leaf = (base: P2, tip: P2, flank: P2, flank2: P2): string =>
  `M${xy(base)}Q${xy(flank)} ${xy(tip)}Q${xy(flank2)} ${xy(base)}Z`;

export const disc = (
  center: Vec3,
  u: Vec3,
  v: Vec3,
  radius: number,
  project: (p: Vec3) => P2,
  steps = 14,
): string => {
  const points = Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;

    return project([
      center[0] + (u[0] * Math.cos(angle) + v[0] * Math.sin(angle)) * radius,
      center[1] + (u[1] * Math.cos(angle) + v[1] * Math.sin(angle)) * radius,
      center[2] + (u[2] * Math.cos(angle) + v[2] * Math.sin(angle)) * radius,
    ]);
  });

  return smooth(points, true);
};
