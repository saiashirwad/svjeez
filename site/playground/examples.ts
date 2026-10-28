import curve from "./examples/curve.tsx.txt" with { type: "text" };
import toast from "./examples/toast.tsx.txt" with { type: "text" };
import orbit from "./examples/orbit.tsx.txt" with { type: "text" };
import flowchart from "./examples/flowchart.tsx.txt" with { type: "text" };
import explainer from "./examples/explainer.tsx.txt" with { type: "text" };
import adaptive from "./examples/adaptive.tsx.txt" with { type: "text" };

export interface PlaygroundExample {
  readonly id: string;
  readonly label: string;
  readonly source: string;
}

export const examples: readonly PlaygroundExample[] = [
  { id: "curve", label: "Draw-on curve", source: curve },
  { id: "toast", label: "Toast", source: toast },
  { id: "orbit", label: "Orbit", source: orbit },
  { id: "flowchart", label: "Flowchart", source: flowchart },
  { id: "explainer", label: "Code explainer", source: explainer },
  { id: "adaptive", label: "Light and dark", source: adaptive },
];
