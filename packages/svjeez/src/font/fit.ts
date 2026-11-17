import type { Font } from "./font";

export interface FitTextOptions {
  /** The room the widest line may fill, in px. */
  readonly width: number;
  /** The size to use when everything fits, and the cap otherwise. */
  readonly max: number;
  /** A floor, so a long text is not shrunk past reading. Default 1. */
  readonly min?: number;
  /** Extra room after the last line, in ems of the result: a mascot or a full stop that sits at the end of a title. */
  readonly tail?: number;
}

/**
 * The largest whole-pixel font size, up to `max`, at which every line of `text` fits in `width`. `tail` reserves
 * ems of room after the last line.
 */
export const fitText = (
  font: Font,
  text: string | readonly string[],
  { width, max, min = 1, tail = 0 }: FitTextOptions,
): number => {
  const lines = [text].flat();

  if (lines.length === 0 || !(width > 0) || !(max >= min))
    throw new Error(
      `fitText() needs at least one line, a positive width and a max of at least min, got ${lines.length} lines, width ${width}, max ${max} and min ${min}.`,
    );

  const ems = Math.max(
    ...lines.map((line, i) => font.measure(line, 1) + (i === lines.length - 1 ? tail : 0)),
  );

  return Math.max(min, Math.min(max, ems === 0 ? max : Math.floor(width / ems)));
};
