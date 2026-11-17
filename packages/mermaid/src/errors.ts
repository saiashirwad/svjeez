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

export interface Line {
  readonly line: number;
  readonly text: string;
}

export function fail(l: Line, problem: string): never {
  throw new MermaidSyntaxError(l.line, l.text, problem);
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
