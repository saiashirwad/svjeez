import { mermaid, parseMermaid, type MermaidDiagram, type MermaidDoc } from "@svjeez/mermaid";
import type { Font } from "svjeez/tools";

const text = "flowchart LR\nA([Start]) --> B{OK?}\nB -->|yes| C[Ship]";
const doc: MermaidDoc = parseMermaid(text, { file: "flow.mmd" });

export const draw = (font: Font): MermaidDiagram => mermaid(text, { font, file: "flow.mmd" });

export const kind: string = doc.kind;
