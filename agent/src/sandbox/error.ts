/** Why a scene did not compile, placed on its source so the model can fix it from this alone. */
export interface CompileError {
  /** syntax: it does not parse; import: it imports something unavailable; runtime: it threw; limit: it ran too long or too big. */
  readonly kind: "syntax" | "import" | "runtime" | "limit";
  readonly message: string;
  /** 1-based, in the scene's own source. */
  readonly line?: number;
  /** 1-based; left out when the line was rewritten by the transpiler and the runtime's column would mislead. */
  readonly column?: number;
  /** The offending line with one line either side, numbered, the offending one marked with `>`. */
  readonly excerpt?: string;
}

/** Lines `line - 1` to `line + 1` of `source`, numbered, with `line` marked. */
export const excerpt = (source: string, line: number) =>
  source
    .split("\n")
    .map((text, i) => ({ n: i + 1, text }))
    .slice(Math.max(0, line - 2), line + 1)
    .map(({ n, text }) => `${n === line ? ">" : " "} ${String(n).padStart(4)} | ${text}`)
    .join("\n");

/** An error at `line` (and `column`, when known) of `source`, with its excerpt. */
export const at = (
  source: string,
  kind: CompileError["kind"],
  message: string,
  line?: number,
  column?: number,
): CompileError => {
  if (line === undefined) return { kind, message };

  const placed = { kind, message, line, excerpt: excerpt(source, line) };

  return column === undefined ? placed : { ...placed, column };
};
