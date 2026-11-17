/** `[ ]`, `( )`, `([ ])`, `{ }`, `(( ))`, `[[ ]]` and `[( )]`, by name. */
export type FlowForm =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "circle"
  | "subroutine"
  | "cylinder";

export interface MermaidFlowNode {
  readonly id: string;
  readonly label: string;
  readonly form: FlowForm;
}

export interface MermaidFlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  /** `-->` and `---` are solid, `-.->` dotted, `==>` thick. */
  readonly line: "solid" | "dotted" | "thick";
  readonly arrow: boolean;
}

export interface FlowSubgraph {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly string[];
}

export interface FlowchartDoc {
  readonly kind: "flowchart";
  /** As written: `TD` and `TB` both mean top to bottom. */
  readonly direction: "TD" | "TB" | "BT" | "LR" | "RL";
  readonly nodes: readonly MermaidFlowNode[];
  readonly edges: readonly MermaidFlowEdge[];
  readonly subgraphs: readonly FlowSubgraph[];
}

export interface MermaidParticipant {
  readonly id: string;
  readonly label: string;
  readonly role: "participant" | "actor";
}

export interface MermaidSequenceMessage {
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
  readonly participants: readonly MermaidParticipant[];
  readonly items: readonly (MermaidSequenceMessage | SequenceNote)[];
}

export interface StateNode {
  readonly id: string;
  readonly label: string;
  readonly final: boolean;
  readonly inner?: { readonly initial: string; readonly states: readonly StateNode[] };
}

export interface MermaidStateTransition {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface StateDoc {
  readonly kind: "state";
  readonly direction?: "TB" | "LR";
  readonly initial: string;
  readonly states: readonly StateNode[];
  /** Every transition, with ids from any depth. `[*]` ends are in `initial` and `final`, not here. */
  readonly transitions: readonly MermaidStateTransition[];
}

export type MermaidDoc = FlowchartDoc | SequenceDoc | StateDoc;
