import toast from "./examples/toast.tsx.txt?raw";
import terminal from "./examples/terminal.tsx.txt?raw";
import explainer from "./examples/explainer.tsx.txt?raw";
import adaptive from "./examples/adaptive.tsx.txt?raw";
import chart from "./examples/chart.tsx.txt?raw";
import area from "./examples/area.tsx.txt?raw";
import highlight from "./examples/highlight.tsx.txt?raw";
import equation from "./examples/equation.tsx.txt?raw";
import derive from "./examples/derive.tsx.txt?raw";
import epicycles from "./examples/epicycles.tsx.txt?raw";
import icons from "./examples/icons.tsx.txt?raw";
import map from "./examples/map.tsx.txt?raw";
import mermaid from "./examples/mermaid.tsx.txt?raw";
import sequence from "./examples/sequence.tsx.txt?raw";

export interface PlaygroundExample {
  readonly id: string;
  readonly label: string;
  /** The package the scene shows off, or "svjeez" for the core. The menu groups by it. */
  readonly from: string;
  readonly source: string;
}

export const examples: readonly PlaygroundExample[] = [
  { id: "toast", label: "Toast", from: "svjeez", source: toast },
  { id: "terminal", label: "Terminal", from: "svjeez", source: terminal },
  { id: "explainer", label: "Code explainer", from: "svjeez", source: explainer },
  { id: "adaptive", label: "Light and dark", from: "svjeez", source: adaptive },
  { id: "chart", label: "Bars and a line", from: "@svjeez/charts", source: chart },
  { id: "area", label: "Area chart", from: "@svjeez/charts", source: area },
  { id: "highlight", label: "Highlighted code", from: "@svjeez/code", source: highlight },
  { id: "equation", label: "Equation morph", from: "@svjeez/math", source: equation },
  { id: "derive", label: "Derivation", from: "@svjeez/math", source: derive },
  { id: "epicycles", label: "Epicycles", from: "@svjeez/math", source: epicycles },
  { id: "icons", label: "Icons", from: "@svjeez/icons", source: icons },
  { id: "map", label: "Flight route", from: "@svjeez/geo", source: map },
  { id: "mermaid", label: "Flowchart", from: "@svjeez/mermaid", source: mermaid },
  { id: "sequence", label: "Sequence diagram", from: "@svjeez/mermaid", source: sequence },
];
