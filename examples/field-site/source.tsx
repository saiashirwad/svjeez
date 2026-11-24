import { useMemo, type ReactNode } from "react";

/** The scene's own file, cut to what sits between its `// source: begin` and `// source: end` lines. */
export const trimmed = (file: string): string => {
  const lines = file.split("\n");
  const begin = lines.findIndex((line) => line.trim() === "// source: begin");
  const end = lines.findIndex((line) => line.trim() === "// source: end");

  return lines
    .slice(begin + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
};

const TOKENS =
  /(\/\*\*[\s\S]*?\*\/|\/\/[^\n]*)|("use gpu")|("(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(<\/?[A-Z][\w.]*|\/>)|\b(const|return|export|default|type|import|from|as)\b|\b(\d+(?:\.\d+)?)\b/g;

const KINDS = ["comment", "gpu", "string", "tag", "keyword", "number"] as const;

/** One line's text as spans, each token wrapped in a class that names its kind. */
const painted = (text: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKENS)) {
    const index = match.index;
    const kind = KINDS[match.slice(1).findIndex((group) => group !== undefined)];

    if (index > last) out.push(text.slice(last, index));
    out.push(
      <span key={index} className={`t-${kind}`}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }

  if (last < text.length) out.push(text.slice(last));

  return out;
};

/**
 * Which lines run on the GPU: each function whose body starts with "use gpu", from the line that opens it to the
 * line where its braces close.
 */
const gpuLines = (lines: readonly string[]): Set<number> => {
  const gpu = new Set<number>();

  lines.forEach((line, index) => {
    if (!line.includes('"use gpu"')) return;
    let depth = 0;
    let start = index - 1;

    while (start > 0 && !/=>\s*\{$|\{$/.test(lines[start]!.trimEnd())) start -= 1;

    for (let at = start; at < lines.length; at++) {
      gpu.add(at);
      depth += (lines[at]!.match(/\{/g) ?? []).length - (lines[at]!.match(/\}/g) ?? []).length;

      if (depth <= 0 && at > start) break;
    }
  });

  return gpu;
};

/** The source, highlighted, with the lines that run on the GPU marked in the gutter. */
export const Source = ({ code }: { readonly code: string }) => {
  const lines = useMemo(() => code.split("\n"), [code]);
  const gpu = useMemo(() => gpuLines(lines), [lines]);

  return (
    <pre className="code">
      <code>
        {lines.map((line, index) => (
          <span key={index} className={gpu.has(index) ? "line on-gpu" : "line"}>
            {/^\s*(\/\*\*|\*)/.test(line) ? (
              <span className="t-comment">{line}</span>
            ) : (
              painted(line)
            )}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
};
