import { mermaid, parse, type MermaidDiagram, type MermaidDoc } from "@svjeez/mermaid";
import { render } from "svjeez";

const text = "flowchart LR\nA([Start]) --> B{OK?}\nB -->|yes| C[Ship]";
const doc: MermaidDoc = parse(text);
const diagram: MermaidDiagram = mermaid(text, { fontSize: 14 });

export const svg: string = render({ width: 600, height: 300, duration: 4, title: "Mermaid" }, [
  diagram.node,
]);

export const kind: string = doc.kind === "flowchart" ? doc.direction : diagram.kind;
