const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Coordinates in thousandths, so relative steps sum back to exactly the absolute points written. */
interface Segment {
  readonly command: string;
  readonly args: readonly number[];
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;
const SPACE = /^[\s,]*/;

const thousandths = (value: number): number => Math.round(value * 1000);

const parse = (d: string): Segment[] | undefined => {
  const segments: Segment[] = [];
  let rest = d.trim();
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = "";
  const skip = () => (rest = rest.slice(SPACE.exec(rest)![0].length));
  const read = (flag: boolean): number | undefined => {
    skip();
    const match = flag ? /^[01]/.exec(rest) : NUMBER.exec(rest);
    if (!match) return undefined;
    rest = rest.slice(match[0].length);
    return Number(match[0]);
  };
  while ((skip(), rest.length > 0)) {
    if (/^[a-zA-Z]/.test(rest)) {
      command = rest[0]!;
      rest = rest.slice(1);
      if (!(command.toUpperCase() in ARITY)) return undefined;
    } else if (command === "" || command.toUpperCase() === "Z") return undefined;
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const raw: number[] = [];
    for (let i = 0; i < ARITY[upper]!; i++) {
      const value = read(upper === "A" && (i === 3 || i === 4));
      if (value === undefined) return undefined;
      raw.push(value);
    }
    let args: number[];
    if (upper === "H") args = [thousandths(raw[0]! + (relative ? x / 1000 : 0))];
    else if (upper === "V") args = [thousandths(raw[0]! + (relative ? y / 1000 : 0))];
    else if (upper === "A") args = [...raw.slice(0, 3).map(thousandths), raw[3]!, raw[4]!, thousandths(raw[5]! + (relative ? x / 1000 : 0)), thousandths(raw[6]! + (relative ? y / 1000 : 0))];
    else args = raw.map((value, i) => thousandths(value + (relative ? (i % 2 === 0 ? x : y) / 1000 : 0)));
    if (upper === "Z") [x, y] = [startX, startY];
    else if (upper === "H") x = args[0]!;
    else if (upper === "V") y = args[0]!;
    else [x, y] = args.slice(-2) as [number, number];
    if (upper === "M") [startX, startY] = [x, y];
    segments.push({ command: upper, args });
    if (upper === "M") command = relative ? "l" : "L";
  }
  return segments;
};

const format = (k: number): string => {
  const sign = k < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(k) / 1000);
  const fraction = String(Math.abs(k) % 1000).padStart(3, "0").replace(/0+$/, "");
  if (fraction === "") return `${sign}${whole}`;
  return `${sign}${whole === 0 ? "" : whole}.${fraction}`;
};

const join = (numbers: readonly string[], after: string): string => {
  let out = "";
  let last = after;
  for (const text of numbers) {
    const glued = last === "" || text.startsWith("-") || (text.startsWith(".") && last.includes("."));
    out += glued ? text : ` ${text}`;
    last = text;
  }
  return out;
};

/**
 * Rewrite path data at 3 decimals, picking absolute or relative per segment, whichever is shorter.
 * Returns the input unchanged when it does not parse.
 */
export const compactPath = (d: string): string => {
  const segments = parse(d);
  if (!segments) return d;
  let out = "";
  let previous = "";
  let tail = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const { command, args } of segments) {
    let upper = command;
    let absolute = args;
    if (upper === "L" && args[1] === y) [upper, absolute] = ["H", [args[0]!]];
    else if (upper === "L" && args[0] === x) [upper, absolute] = ["V", [args[1]!]];
    const relative =
      upper === "H" ? [absolute[0]! - x]
      : upper === "V" ? [absolute[0]! - y]
      : upper === "A" ? [...absolute.slice(0, 5), absolute[5]! - x, absolute[6]! - y]
      : absolute.map((value, i) => value - (i % 2 === 0 ? x : y));
    const text = (values: readonly number[]) => values.map((value, i) => (upper === "A" && (i === 3 || i === 4) ? String(value) : format(value)));
    const candidates = [upper, upper.toLowerCase()].map((letter, i) => {
      const numbers = upper === "Z" ? [] : text(i === 0 ? absolute : relative);
      const implicit = letter === previous && upper !== "Z" && upper !== "M";
      const body = implicit ? join(numbers, tail) : letter + join(numbers, "");
      return { letter, body, last: numbers.at(-1) ?? "" };
    });
    const best = candidates[1]!.body.length < candidates[0]!.body.length ? candidates[1]! : candidates[0]!;
    out += best.body;
    tail = best.last;
    previous = upper === "M" ? (best.letter === "M" ? "L" : "l") : best.letter;
    if (upper === "Z") [x, y] = [startX, startY];
    else if (upper === "H") x = absolute[0]!;
    else if (upper === "V") y = absolute[0]!;
    else [x, y] = absolute.slice(-2) as [number, number];
    if (upper === "M") [startX, startY] = [x, y];
  }
  return out;
};
