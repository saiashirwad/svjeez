import { SceneError } from "svjeez/tools";
import { fail, type Line } from "./errors.ts";
import { parseClass } from "./class.ts";
import { parseEr } from "./er.ts";
import { parseFlowchart } from "./flowchart.ts";
import { parseGantt } from "./gantt.ts";
import { parseGit } from "./git.ts";
import { parseJourney } from "./journey.ts";
import { parseMindmap } from "./mindmap.ts";
import { parsePie } from "./pie.ts";
import { parseSequence } from "./sequence.ts";
import { parseState } from "./state.ts";
import { parseTimeline } from "./timeline.ts";
import type { MermaidDoc, ParseOptions } from "./types.ts";

const KINDS =
  "Supported diagram types: `flowchart`/`graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`/`stateDiagram-v2`, `erDiagram`, `gantt`, `pie`, `mindmap`, `gitGraph`, `journey` and `timeline`.";

const lines = (text: string, file: string, first: number): Line[] =>
  text.split(/\r?\n/).flatMap((raw, i): Line[] => {
    const trimmed = raw.trim();
    const indent = (/^\s*/.exec(raw)?.[0] ?? "").replace(/\t/g, "    ").length;
    const l = { file, line: first + i, text: trimmed.replace(/\s*;$/, ""), indent };

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

  const exact = first.text === word;

  if ((word === "classDiagram" || word === "classDiagram-v2") && exact)
    return parseClass(first, body);

  if (word === "erDiagram" && exact) return parseEr(first, body);

  if (word === "gantt" && exact) return parseGantt(first, body);

  if (word === "journey" && exact) return parseJourney(first, body);

  if (word === "pie") return parsePie(first, body);

  if (word === "mindmap") return parseMindmap(first, body);

  if (word === "gitGraph") return parseGit(first, body);

  if (word === "timeline") return parseTimeline(first, body);

  return fail(first, `the first line must name a diagram type. ${KINDS}`);
}
