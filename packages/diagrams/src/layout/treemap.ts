export interface TreemapInput {
  readonly id: string;
  /** A leaf's own value; a section's value is the sum of what it holds. */
  readonly value: number;
  readonly children: readonly TreemapInput[];
}

export interface TreemapBox {
  readonly id: string;
  /** The position among the top-level nodes of this branch, which picks its color. */
  readonly series: number;
  readonly value: number;
  readonly leaf: boolean;
  /** Whether a section draws its header; small ones hand that space to their children. */
  readonly headed: boolean;
  readonly header: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreemapInsets {
  readonly gap: number;
  /** The room a section keeps for its header, and its shorter header for small boxes. */
  readonly header: number;
  readonly short: number;
  /** The room around a section's children on the other three sides. */
  readonly side: number;
}

interface Work {
  readonly input: TreemapInput;
  readonly series: number;
  readonly children: Work[];
  value: number;
  headed: boolean;
  header: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, low: number, high: number): number =>
  v >= low ? Math.min(v, high) : low;

const squarify = (
  boxes: readonly Work[],
  total: number,
  [x0, y0, w0, h0]: readonly [number, number, number, number],
  gap: number,
): void => {
  let [x, y, w, h] = [x0, y0, w0, h0];
  let rest = total;
  let from = 0;

  while (from < boxes.length) {
    const scale = (w * h) / rest;
    const side = Math.min(w, h);
    let sum = boxes[from]!.value * scale;
    const largest = sum;

    let worst = Math.max(
      (side * side * largest) / (sum * sum),
      (sum * sum) / (side * side * largest),
    );

    let to = from + 1;

    while (to < boxes.length) {
      const smallest = boxes[to]!.value * scale;
      const next = sum + smallest;

      const ratio = Math.max(
        (side * side * largest) / (next * next),
        (next * next) / (side * side * smallest),
      );

      if (ratio > worst) break;
      worst = ratio;
      sum = next;
      to++;
    }

    const thickness = sum / side;
    let offset = 0;

    for (let i = from; i < to; i++) {
      const b = boxes[i]!;
      const length = i === to - 1 ? side - offset : (b.value * scale) / thickness;
      const [bx, by] = w >= h ? [x, y + offset] : [x + offset, y];
      const [bw, bh] = w >= h ? [thickness, length] : [length, thickness];
      const gx = Math.round(bx + bw - gap / 2) > Math.round(bx + gap / 2) ? gap / 2 : 0;
      const gy = Math.round(by + bh - gap / 2) > Math.round(by + gap / 2) ? gap / 2 : 0;
      b.x = Math.round(bx + gx);
      b.y = Math.round(by + gy);
      b.w = Math.round(bx + bw - gx) - b.x;
      b.h = Math.round(by + bh - gy) - b.y;
      offset += length;
      rest -= b.value;
    }

    if (w >= h) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }

    from = to;
  }
};

const build = (input: TreemapInput, series: number): Work => {
  const children = input.children.map((c) => build(c, series));

  const value =
    input.children.length === 0 ? input.value : children.reduce((s, c) => s + c.value, 0);

  return { input, series, children, value, headed: false, header: 0, x: 0, y: 0, w: 0, h: 0 };
};

/** Squarified boxes for every node with a value, parents before their children. */
export const layoutTreemap = (
  roots: readonly TreemapInput[],
  width: number,
  height: number,
  { gap, header, short, side }: TreemapInsets,
): TreemapBox[] => {
  const top = roots.map(build);
  const placed: Work[] = [];

  const place = (children: readonly Work[], x: number, y: number, w: number, h: number): void => {
    const shown = children.filter((b) => b.value > 0).toSorted((a, b) => b.value - a.value);
    const total = shown.reduce((s, b) => s + b.value, 0);

    if (shown.length === 0 || !Number.isFinite(total)) return;
    const [pw, ph] = [Math.max(0, w), Math.max(0, h)];

    if (pw > 0 && ph > 0)
      squarify(shown, total, [x - gap / 2, y - gap / 2, pw + gap, ph + gap], gap);

    for (const b of shown) {
      const x0 = clamp(b.x, x, x + pw);
      const y0 = clamp(b.y, y, y + ph);
      b.w = clamp(b.x + b.w, x0, x + pw) - x0;
      b.h = clamp(b.y + b.h, y0, y + ph) - y0;
      b.x = x0;
      b.y = y0;
      placed.push(b);
    }
  };

  place(top, 0, 0, width, height);

  for (let i = 0; i < placed.length; i++) {
    const b = placed[i]!;

    if (b.children.length === 0) continue;
    const head = b.h - header - side >= 12 ? header : short;
    b.headed = b.w > Math.max(24, 2 * side) && b.h - head - side >= 8;
    b.header = b.headed ? head : 0;

    if (b.headed) place(b.children, b.x + side, b.y + head, b.w - 2 * side, b.h - head - side);
    else place(b.children, b.x, b.y, b.w, b.h);
  }

  return placed.map((b) => ({
    id: b.input.id,
    series: b.series,
    value: b.value,
    leaf: b.children.length === 0,
    headed: b.headed,
    header: b.header,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
  }));
};
