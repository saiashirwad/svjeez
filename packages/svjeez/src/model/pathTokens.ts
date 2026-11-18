export interface PathSegment {
  readonly letter: string;
  readonly numbers: number[];
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/iy;
const FLAG = /[01]/y;
const LETTER = /[A-Za-z]/;

export const segments = (d: string): PathSegment[] => {
  const out: PathSegment[] = [];
  let at = 0;

  while (at < d.length) {
    const char = d[at]!;

    if (LETTER.test(char)) {
      out.push({ letter: char, numbers: [] });
      at++;
      continue;
    }

    const current = out[out.length - 1];

    const flag =
      current !== undefined &&
      /a/i.test(current.letter) &&
      [3, 4].includes(current.numbers.length % 7);

    const pattern = flag ? FLAG : NUMBER;
    pattern.lastIndex = at;
    const match = pattern.exec(d);

    if (match === null) {
      at++;
      continue;
    }

    if (current === undefined) {
      out.push({ letter: "", numbers: [Number(match[0])] });
    } else current.numbers.push(Number(match[0]));
    at += match[0].length;
  }

  return out;
};
