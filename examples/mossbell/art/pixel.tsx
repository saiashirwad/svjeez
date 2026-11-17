/** @jsxImportSource svjeez */
import { motion, type Color, type SvgNode } from "svjeez";

/** The side of one art pixel, in world px. Everything in Mossbell is drawn on this grid. */
export const PX = 3;

/** A grid of pixels to draw on. Every drawing call returns the canvas, so calls chain. */
export interface Canvas {
  readonly width: number;
  readonly height: number;
  at(x: number, y: number): Color | undefined;
  dot(x: number, y: number, color: Color): Canvas;
  box(x: number, y: number, width: number, height: number, color: Color): Canvas;
  /** A filled ellipse about a center, which may sit between pixels. */
  oval(cx: number, cy: number, rx: number, ry: number, color: Color): Canvas;
  clear(x: number, y: number): Canvas;
  /** Outline everything drawn so far: color each empty pixel that touches a filled one. */
  rim(color: Color): Canvas;
  /** Outline with a color made from each neighbor: a darker red around red, a darker green around green. */
  edge(from: (near: Color) => Color): Canvas;
  /** Recolor filled pixels a function picks: texture, dither and shading. */
  tint(pick: (x: number, y: number, color: Color) => Color | undefined): Canvas;
  /** Copy another canvas onto this one with its top left at `x, y`. */
  stamp(other: Canvas, x: number, y: number): Canvas;
  /** The same canvas with every call moved by `dx, dy`. */
  from(dx: number, dy: number): Canvas;
  /** A copy turned a quarter turn clockwise. The canvas must be square. */
  turned(): Canvas;
}

export const canvas = (width: number, height: number): Canvas => {
  const cells: (Color | undefined)[] = Array.from({ length: width * height });

  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;

  const view = (dx: number, dy: number): Canvas => {
    const self: Canvas = {
      width,
      height,
      at: (x, y) => (inside(x + dx, y + dy) ? cells[(y + dy) * width + x + dx] : undefined),
      dot(x, y, color) {
        if (inside(x + dx, y + dy)) cells[(y + dy) * width + x + dx] = color;

        return self;
      },
      box(x, y, w, h, color) {
        for (let row = y; row < y + h; row++)
          for (let column = x; column < x + w; column++) self.dot(column, row, color);

        return self;
      },
      oval(cx, cy, rx, ry, color) {
        for (let row = Math.floor(cy - ry); row <= Math.ceil(cy + ry); row++)
          for (let column = Math.floor(cx - rx); column <= Math.ceil(cx + rx); column++)
            if (((column + 0.5 - cx) / rx) ** 2 + ((row + 0.5 - cy) / ry) ** 2 <= 1)
              self.dot(column, row, color);

        return self;
      },
      clear(x, y) {
        if (inside(x + dx, y + dy)) cells[(y + dy) * width + x + dx] = undefined;

        return self;
      },
      rim: (color) => self.edge(() => color),
      edge(from) {
        const before = [...cells];

        const near = (x: number, y: number): Color | undefined =>
          inside(x, y) ? before[y * width + x] : undefined;

        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const beside = near(x, y + 1) ?? near(x, y - 1) ?? near(x - 1, y) ?? near(x + 1, y);

            if (near(x, y) === undefined && beside !== undefined)
              cells[y * width + x] = from(beside);
          }

        return self;
      },
      tint(pick) {
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const color = cells[y * width + x];

            if (color !== undefined) cells[y * width + x] = pick(x - dx, y - dy, color) ?? color;
          }

        return self;
      },
      stamp(other, x, y) {
        for (let row = 0; row < other.height; row++)
          for (let column = 0; column < other.width; column++) {
            const color = other.at(column, row);

            if (color !== undefined) self.dot(x + column, y + row, color);
          }

        return self;
      },
      from: (mx, my) => view(dx + mx, dy + my),
      turned() {
        const copy = canvas(height, width);

        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const color = cells[y * width + x];

            if (color !== undefined) copy.dot(height - 1 - y, x, color);
          }

        return copy;
      },
    };

    return self;
  };

  return view(0, 0);
};

/** A canvas from rows of text: each character is a pixel in the ink of that name, and a dot is empty. */
export const sketch = (rows: readonly string[], inks: ReadonlyMap<string, Color>): Canvas => {
  const drawn = canvas(Math.max(...rows.map((row) => row.length)), rows.length);

  for (const [y, row] of rows.entries())
    for (const [x, name] of [...row].entries()) {
      const ink = inks.get(name);

      if (ink) drawn.dot(x, y, ink);
    }

  return drawn;
};

interface Run {
  readonly x: number;
  readonly y: number;
  readonly wide: number;
  tall: number;
}

/** One path per color, made of rectangles: runs along a row, joined to the same run on the rows below. */
const paths = (of: Canvas): Map<Color, string[]> => {
  const drawn = new Map<Color, string[]>();
  let open = new Map<string, readonly [Color, Run]>();

  const close = ([color, { x, y, wide, tall }]: readonly [Color, Run]): void => {
    const d = drawn.get(color) ?? [];

    d.push(`M${x} ${y}h${wide}v${tall}h${-wide}z`);
    drawn.set(color, d);
  };

  for (let y = 0; y <= of.height; y++) {
    const next = new Map<string, readonly [Color, Run]>();

    for (let x = 0; x < of.width;) {
      const color = of.at(x, y);
      let end = x + 1;

      if (color === undefined) {
        x = end;
        continue;
      }

      while (end < of.width && of.at(end, y) === color) end++;
      const key = `${color}|${x}|${end - x}`;
      const above = open.get(key);

      if (above) above[1].tall++;
      next.set(key, above ?? [color, { x, y, wide: end - x, tall: 1 }]);
      x = end;
    }

    for (const [key, run] of open) if (!next.has(key)) close(run);
    open = next;
  }

  return drawn;
};

export interface PixelsProps {
  readonly of: Canvas;
  /** The pixel of the canvas that sits at 0,0. Default its top left. */
  readonly anchor?: readonly [x: number, y: number];
}

/** A canvas as SVG: hard-edged squares, {@link PX} world px each. */
export const Pixels = ({ of, anchor }: PixelsProps): SvgNode => {
  const [ax, ay] = anchor ?? [0, 0];

  return (
    <g
      transform={`translate(${-ax * PX} ${-ay * PX}) scale(${PX})`}
      style="shape-rendering:crispEdges"
    >
      {[...paths(of)].map(([color, d]) => (
        <path d={d.join("")} fill={color} />
      ))}
    </g>
  );
};

export type Cells = readonly (readonly [picture: SvgNode, seconds: number])[];

/** Frame animation: each picture shows for its seconds, then the next, around and around. */
export const Flipbook = ({ cells }: { readonly cells: Cells }): SvgNode => {
  const total = cells.reduce((sum, [, seconds]) => sum + seconds, 0);
  let start = 0;

  return (
    <>
      {cells.map(([picture, seconds], i) => {
        const from = start;
        const to = (start += seconds);
        const first = i === 0;
        const last = i === cells.length - 1;

        const flip = first
          ? motion({ opacity: 1 }).set({ opacity: 0 }, to)
          : last
            ? motion({ opacity: 0 }).set({ opacity: 1 }, from)
            : motion({ opacity: 0 }).set({ opacity: 1 }, from).set({ opacity: 0 }, to);

        return <g animation={cells.length > 1 ? flip.loop(total) : undefined}>{picture}</g>;
      })}
    </>
  );
};
