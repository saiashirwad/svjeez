/** @jsxImportSource svjeez */
import { Group, Shape, ease, path, span, track, type Paint, type SceneElement } from "svjeez";
import { strokeFont, type StrokeFont } from "./stroke-font.ts";

export { strokeFont, type StrokeFont };

let casualFont: Promise<StrokeFont> | undefined;

/** EMS Casual Hand, a marker-like single-line font, bundled with this package (SIL OFL 1.1, see `fonts/EMSCasualHand-OFL.txt`). Read once, on first call. */
export const casual = (): Promise<StrokeFont> =>
  (casualFont ??= strokeFont.load(new URL("./fonts/EMSCasualHand.svg", import.meta.url)));

export interface HandwriteOptions {
  /** The width to center the text across. */
  readonly width: number;
  /** The baseline. */
  readonly y: number;
  /** When the first stroke starts, in seconds. Defaults to `0`. */
  readonly from?: number;
  /** The font size. Defaults to `40`. */
  readonly size?: number;
  /** How fast the pen moves, in units per second. Defaults to `600`. */
  readonly speed?: number;
}

export interface Pen {
  /** Where each stroke starts, how long it takes, and its path data. */
  readonly strokes: readonly { readonly d: string; readonly at: number; readonly over: number }[];
  /** When the last stroke is done. */
  readonly end: number;
}

/** The length of a stroke's polyline through every point of its path data, control points included. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

/** `text` in a stroke font, centered across `width` on a baseline at `y`, one stroke after another from `from`. */
export const handwrite = (
  font: StrokeFont,
  text: string,
  { width, y, from = 0, size = 40, speed = 600 }: HandwriteOptions,
): Pen => {
  const xs = (font.path(text, { size }).match(/-?[\d.]+/g) ?? [])
    .map(Number)
    .filter((_, i) => i % 2 === 0);

  const left = Math.min(...xs);
  const d = font.path(text, { size, x: (width - (Math.max(...xs) - left)) / 2 - left, y });
  let at = from;

  const strokes = d.split(/(?=M)/).map((piece) => {
    const over = Math.max(0.06, lengthOf(piece) / speed);
    const stroke = { d: piece, at, over };
    at += over + 0.02;

    return stroke;
  });

  return { strokes, end: at };
};

export interface LetteringProps extends HandwriteOptions {
  readonly font: StrokeFont;
  readonly text: string;
  /** The marker's color. */
  readonly ink: Paint;
}

/** `text` handwritten in a marker, stroke by stroke: see `handwrite`. */
export const Lettering = ({ font, text, ink, ...place }: LetteringProps): SceneElement => (
  <Group>
    {handwrite(font, text, place).strokes.map(({ d, at, over }, i) => (
      <Shape
        key={`stroke${i}`}
        geometry={path.parse(d)}
        stroke={{ color: ink, width: 3.4, cap: "round", join: "round" }}
        draw={track(0).to(1, span(at, over), ease.linear)}
      />
    ))}
  </Group>
);
