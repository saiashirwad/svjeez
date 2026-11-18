import { pathData, type Geometry } from "svjeez";

type Tenths = readonly [number, number];

const tenth = (v: number) => Math.round(v * 10);

const straighten = (line: readonly Tenths[], epsilon: number): Tenths[] => {
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

export const rings = (
  list: readonly (readonly (readonly [number, number])[])[],
  closed: readonly boolean[],
): string =>
  list
    .map((ring, i) => {
      const points = ring.map(([x, y]) => `${tenth(x) / 10} ${tenth(y) / 10}`);

      return `M${points.join("L")}${closed[i] ? `L${points[0]}Z` : ""}`;
    })
    .join("");

export class Outline {
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

  arc(): void {}

  geometry(): Geometry | undefined {
    this.#flush();

    return this.#out ? pathData(this.#out) : undefined;
  }

  #flush(): void {
    if (!this.#closed && this.#tail) this.#line.push(this.#tail);
    const line = straighten(this.#line, this.#min / 2);

    if (line.length >= (this.#closed ? 3 : 2))
      this.#out += `M${line.map(([x, y]) => `${x / 10} ${y / 10}`).join("L")}${this.#closed ? "Z" : ""}`;

    this.#line = [];
    this.#tail = undefined;
    this.#closed = false;
  }
}
