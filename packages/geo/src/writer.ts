/** Tenths of a pixel, the grid every coordinate is rounded to. */
const tenth = (v: number) => Math.round(v * 10);

const number = (t: number) => (t / 10).toString().replace(/^(-?)0\./, "$1.");

/**
 * A d3-geo path context that writes compact path data. Coordinates are rounded to 0.1px, a point closer than
 * `tolerance` px to the last point kept is dropped, and a ring that keeps fewer than three points is dropped whole.
 */
export class Writer {
  #out = "";
  #line: [number, number][] = [];
  #tail: [number, number] | undefined;
  #closed = false;
  readonly #min: number;

  constructor(tolerance: number) {
    this.#min = tolerance * 10;
  }

  beginPath(): void {}

  moveTo(x: number, y: number): void {
    this.#flush();
    this.#line = [[tenth(x), tenth(y)]];
  }

  lineTo(x: number, y: number): void {
    const point: [number, number] = [tenth(x), tenth(y)];
    const [lx, ly] = this.#line.at(-1)!;

    if (Math.hypot(point[0] - lx, point[1] - ly) >= this.#min) {
      this.#line.push(point);
      this.#tail = undefined;
    } else this.#tail = point;
  }

  closePath(): void {
    this.#closed = true;
  }

  /** d3 draws Point geometries as arcs. Places go through `point()` instead, so these are skipped. */
  arc(): void {}

  toString(): string {
    this.#flush();

    return this.#out;
  }

  #flush(): void {
    // An open line keeps its last point, so a route still ends where it ends.
    if (!this.#closed && this.#tail) this.#line.push(this.#tail);
    const line = straighten(this.#line, this.#min / 2);

    if (line.length >= (this.#closed ? 3 : 2)) {
      let [px, py] = line[0]!;
      let d = `M${number(px)}${join(number(py))}`;

      for (const [i, [x, y]] of line.slice(1).entries()) {
        d += `${i ? join(number(x - px)) : `l${number(x - px)}`}${join(number(y - py))}`;
        [px, py] = [x, y];
      }

      this.#out += this.#closed ? `${d}z` : d;
    }

    this.#line = [];
    this.#tail = undefined;
    this.#closed = false;
  }
}

const join = (n: string) => (n.startsWith("-") ? n : ` ${n}`);

type Tenths = readonly [number, number];

/** Douglas–Peucker: drops the points that sit within `epsilon` of the straight line their neighbours already draw. */
export const straighten = (line: readonly Tenths[], epsilon: number): Tenths[] => {
  if (line.length < 3) return [...line];
  const keep = new Uint8Array(line.length);
  const stack: [number, number][] = [[0, line.length - 1]];
  keep[0] = keep[line.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = line[first]!;
    const [bx, by] = line[last]!;
    const length = Math.hypot(bx - ax, by - ay);
    let far = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const [x, y] = line[i]!;

      const distance = length
        ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length
        : Math.hypot(x - ax, y - ay);

      if (distance > far) [far, index] = [distance, i];
    }

    if (far > epsilon) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return line.filter((_, i) => keep[i]);
};
