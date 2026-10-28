import { fail, type Line } from "./errors.ts";
import { parseFlowchart } from "./flowchart.ts";
import { parseSequence } from "./sequence.ts";
import { parseState } from "./state.ts";
import type { MermaidDoc } from "./types.ts";

const KINDS =
  "Supported diagram types: `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram` and `stateDiagram-v2`.";

/** Meaningful lines only: blank lines and `%%` comments are dropped, a trailing `;` is cut, and numbering keeps the original line numbers. */
const lines = (text: string): Line[] =>
  text.split(/\r?\n/).flatMap((raw, i): Line[] => {
    const trimmed = raw.trim();
    const l = { line: i + 1, text: trimmed.replace(/\s*;$/, "") };

    if (trimmed.startsWith("%%{"))
      return fail(l, "%%{ }%% directives are not supported: configure svjeez through its options.");

    return trimmed === "" || trimmed.startsWith("%%") ? [] : [l];
  });

/** Reads Mermaid text into a plain model, with no svjeez involved. Throws a `MermaidSyntaxError` that names the line. */
export function parse(text: string): MermaidDoc {
  const all = lines(text);
  const first = all[0];

  if (!first)
    throw new Error(
      `parse() got no Mermaid text. Start with a header such as \`flowchart TD\`. ${KINDS}`,
    );
  const word = /^[\w-]+/.exec(first.text)?.[0];

  if (word === "flowchart" || word === "graph") return parseFlowchart(first, all.slice(1));

  if (word === "sequenceDiagram" && first.text === word) return parseSequence(first, all.slice(1));

  if ((word === "stateDiagram" || word === "stateDiagram-v2") && first.text === word)
    return parseState(first, all.slice(1));

  return fail(first, `the first line must name a diagram type. ${KINDS}`);
}
