import { SceneError } from "svjeez/tools";
import type { Place } from "./types.ts";

export interface Line {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

export const sourceOf = (l: Line): Place => ({ file: l.file, line: l.line });

export function fail(l: Line, problem: string): never {
  throw new SceneError(`${JSON.stringify(l.text)}: ${problem}`, undefined, { source: sourceOf(l) });
}

export const clean = (text: string): string =>
  text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const unquote = (text: string): string => {
  const t = text.trim();

  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
};
