/** A line of Mermaid text that this package cannot read or draw. */
export class MermaidSyntaxError extends Error {
  constructor(
    readonly line: number,
    readonly source: string,
    problem: string,
  ) {
    super(`Mermaid syntax error on line ${line} (${JSON.stringify(source)}): ${problem}`);
    this.name = "MermaidSyntaxError";
  }
}

/** One meaningful line of the text: comments and blank lines are gone, and `line` counts from 1. */
export interface Line {
  readonly line: number;
  readonly text: string;
}

export function fail(l: Line, problem: string): never {
  throw new MermaidSyntaxError(l.line, l.text, problem);
}

/** Mermaid's `<br>` becomes a space, because svjeez labels are one line. */
export const clean = (text: string): string =>
  text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const unquote = (text: string): string => {
  const t = text.trim();

  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
};
