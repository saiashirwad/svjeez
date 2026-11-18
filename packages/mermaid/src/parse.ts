import { SceneError } from "svjeez/tools";
import { fail, type Line } from "./errors.ts";
import { parseFlowchart } from "./flowchart.ts";
import { parseSequence } from "./sequence.ts";
import { parseState } from "./state.ts";
import type { MermaidDoc, ParseOptions } from "./types.ts";

const KINDS =
  "Supported diagram types: `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram` and `stateDiagram-v2`.";

const lines = (text: string, file: string, first: number): Line[] =>
  text.split(/\r?\n/).flatMap((raw, i): Line[] => {
    const trimmed = raw.trim();
    const l = { file, line: first + i, text: trimmed.replace(/\s*;$/, "") };

    if (trimmed.startsWith("%%{"))
      return fail(l, "%%{ }%% directives are not supported: configure svjeez through its options.");

    return trimmed === "" || trimmed.startsWith("%%") ? [] : [l];
  });

export function parseMermaid(text: string, options: ParseOptions = {}): MermaidDoc {
  const file = options.file ?? "mermaid";
  const all = lines(text, file, options.line ?? 1);
  const first = all[0];

  if (!first)
    throw new SceneError(
      "parseMermaid() got no Mermaid text.",
      `Start with a header such as \`flowchart TD\`. ${KINDS}`,
      { source: { file, line: options.line ?? 1 } },
    );
  const word = /^[\w-]+/.exec(first.text)?.[0];
  const body = all.slice(1);

  if (word === "flowchart" || word === "graph") return parseFlowchart(first, body);

  if (word === "sequenceDiagram" && first.text === word) return parseSequence(first, body);

  if ((word === "stateDiagram" || word === "stateDiagram-v2") && first.text === word)
    return parseState(first, body);

  return fail(first, `the first line must name a diagram type. ${KINDS}`);
}
