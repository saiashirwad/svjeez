/** `[ ]`, `( )`, `([ ])`, `{ }`, `(( ))`, `[[ ]]` and `[( )]`, by name. */
export type FlowForm =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "circle"
  | "subroutine"
  | "cylinder";

export interface FlowNode {
  readonly id: string;
  readonly label: string;
  readonly form: FlowForm;
}

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  /** `-->` and `---` are solid, `-.->` dotted, `==>` thick. */
  readonly line: "solid" | "dotted" | "thick";
  /** Whether the edge ends in an arrowhead: `-->` does, `---` does not. */
  readonly arrow: boolean;
}

export interface FlowSubgraph {
  readonly id: string;
  readonly title: string;
  /** The nodes mentioned inside it that no earlier subgraph took, in order. */
  readonly nodes: readonly string[];
}

export interface FlowchartDoc {
  readonly kind: "flowchart";
  /** As written: `TD` and `TB` both mean top to bottom. */
  readonly direction: "TD" | "TB" | "BT" | "LR" | "RL";
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly subgraphs: readonly FlowSubgraph[];
}

export interface Participant {
  readonly id: string;
  readonly label: string;
  readonly role: "participant" | "actor";
}

export interface SequenceMessage {
  readonly kind: "message";
  readonly from: string;
  readonly to: string;
  readonly text: string;
  /** `->>` and `->` are solid, `-->>` and `-->` dashed. */
  readonly line: "solid" | "dashed";
  /** `>>` is a filled head, `->` and `-->` have none, `-x` is a cross, `-)` an async arrow. */
  readonly head: "filled" | "none" | "cross" | "async";
}

export interface SequenceNote {
  readonly kind: "note";
  readonly actor: string;
  readonly text: string;
}

export interface SequenceDoc {
  readonly kind: "sequence";
  readonly participants: readonly Participant[];
  readonly items: readonly (SequenceMessage | SequenceNote)[];
}

export interface StateNode {
  readonly id: string;
  readonly label: string;
  /** Whether a transition leads from it to `[*]`. */
  readonly final: boolean;
  /** Set for a composite state: its own start and states. */
  readonly inner?: { readonly initial: string; readonly states: readonly StateNode[] };
}

export interface StateTransition {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface StateDoc {
  readonly kind: "state";
  readonly direction?: "TB" | "LR";
  /** The state `[*] -->` leads to. */
  readonly initial: string;
  readonly states: readonly StateNode[];
  /** Every transition, with ids from any depth. `[*]` ends are in `initial` and `final`, not here. */
  readonly transitions: readonly StateTransition[];
}

export type MermaidDoc = FlowchartDoc | SequenceDoc | StateDoc;
