export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** One continuous run of a path, flattened to points. `closed` when it ended in Z. */
export interface Polyline {
  readonly points: readonly Pt[];
  readonly closed: boolean;
}

const ARGS: Readonly<Record<string, number>> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

const tokens = (d: string): (string | number)[] =>
  [...d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g)].map((m) => (m[1] !== undefined ? m[1] : Number(m[2])));

/** Points per curve: enough that no chord strays far from the curve, judged from the control polygon's length. */
const steps = (...pts: Pt[]): number => {
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return Math.max(2, Math.min(64, Math.ceil(length / 3)));
};

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, out: Pt[]): void => {
  const count = steps(p0, p1, p2, p3);
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const u = 1 - t;
    const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    out.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y });
  }
};

const quadratic = (p0: Pt, p1: Pt, p2: Pt, out: Pt[]): void => {
  const count = steps(p0, p1, p2);
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
  }
};

/** SVG arc, endpoint form, flattened through its center form (SVG 1.1 appendix F.6). */
const arc = (p0: Pt, rx: number, ry: number, rotation: number, large: number, sweep: number, p1: Pt, out: Pt[]): void => {
  if (p0.x === p1.x && p0.y === p1.y) return;
  if (rx === 0 || ry === 0) {
    out.push(p1);
    return;
  }
  const phi = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  [rx, ry] = [Math.abs(rx), Math.abs(ry)];
  const scale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (scale > 1) [rx, ry] = [rx * Math.sqrt(scale), ry * Math.sqrt(scale)];
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const k = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const [cx1, cy1] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
  const cx = cos * cx1 - sin * cy1 + (p0.x + p1.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0.y + p1.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const count = Math.max(2, Math.min(96, Math.ceil((Math.abs(delta) * Math.max(rx, ry)) / 3)));
  for (let i = 1; i <= count; i++) {
    const a = start + (delta * i) / count;
    const [ex, ey] = [rx * Math.cos(a), ry * Math.sin(a)];
    out.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
};

/** Flatten SVG path data, every command absolute or relative, into polylines. */
export const flatten = (d: string): Polyline[] => {
  const list = tokens(d);
  const lines: Polyline[] = [];
  let points: Pt[] = [];
  let pen: Pt = { x: 0, y: 0 };
  let start: Pt = pen;
  let control: Pt | undefined;
  let previous = "";
  const end = (closed: boolean) => {
    if (points.length > 1) lines.push({ points, closed });
    points = [];
  };
  let i = 0;
  let command = "";
  while (i < list.length) {
    if (typeof list[i] === "string") command = list[i++] as string;
    else if (!command) throw new Error(`Path data must start with a command, got "${list[i]}".`);
    const lower = command.toLowerCase();
    const relative = command === lower;
    const count = ARGS[lower]!;
    const args = list.slice(i, i + count) as number[];
    if (args.length < count || args.some((a) => typeof a !== "number")) throw new Error(`Path command ${command} needs ${count} numbers.`);
    i += count;
    const at = (x: number, y: number): Pt => (relative ? { x: pen.x + x, y: pen.y + y } : { x, y });
    const mirror = (after: RegExp): Pt => (control && after.test(previous) ? { x: 2 * pen.x - control.x, y: 2 * pen.y - control.y } : pen);
    switch (lower) {
      case "m":
        end(false);
        pen = start = at(args[0]!, args[1]!);
        points.push(pen);
        command = relative ? "l" : "L";
        control = undefined;
        break;
      case "l":
      case "h":
      case "v": {
        const next = lower === "l" ? at(args[0]!, args[1]!) : lower === "h" ? { x: relative ? pen.x + args[0]! : args[0]!, y: pen.y } : { x: pen.x, y: relative ? pen.y + args[0]! : args[0]! };
        points.push(next);
        pen = next;
        control = undefined;
        break;
      }
      case "c":
      case "s": {
        const [c1, c2, next] = lower === "c" ? [at(args[0]!, args[1]!), at(args[2]!, args[3]!), at(args[4]!, args[5]!)] : [mirror(/[cs]/), at(args[0]!, args[1]!), at(args[2]!, args[3]!)];
        cubic(pen, c1, c2, next, points);
        [pen, control] = [next, c2];
        break;
      }
      case "q":
      case "t": {
        const [c1, next] = lower === "q" ? [at(args[0]!, args[1]!), at(args[2]!, args[3]!)] : [mirror(/[qt]/), at(args[0]!, args[1]!)];
        quadratic(pen, c1, next, points);
        [pen, control] = [next, c1];
        break;
      }
      case "a": {
        const next = at(args[5]!, args[6]!);
        arc(pen, args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, next, points);
        pen = next;
        control = undefined;
        break;
      }
      case "z":
        if (points.length > 0 && (pen.x !== start.x || pen.y !== start.y)) points.push(start);
        end(true);
        pen = start;
        points.push(pen);
        control = undefined;
        break;
    }
    previous = lower;
  }
  end(false);
  return lines;
};
