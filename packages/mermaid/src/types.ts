import type { Where } from "svjeez/tools";
import type { ClassDoc } from "./class.ts";
import type { ErDoc } from "./er.ts";
import type { GanttDoc } from "./gantt.ts";
import type { GitDoc } from "./git.ts";
import type { JourneyDoc } from "./journey.ts";
import type { MindmapDoc } from "./mindmap.ts";
import type { PieDoc } from "./pie.ts";

export type Place = NonNullable<Where["source"]>;

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
  readonly source: Place;
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
  readonly reply: boolean;
  readonly head: "filled" | "none" | "cross" | "async";
}

export interface SequenceNote {
  readonly kind: "note";
  readonly actor: string;
  readonly text: string;
}

export interface SequenceDoc {
  readonly kind: "sequence";
  readonly source: Place;
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
  readonly source: Place;
  readonly direction?: "TB" | "LR";
  readonly initial: string;
  readonly states: readonly StateNode[];
  readonly transitions: readonly MermaidStateTransition[];
}

export type MermaidDoc =
  | FlowchartDoc
  | SequenceDoc
  | ClassDoc
  | StateDoc
  | ErDoc
  | GanttDoc
  | PieDoc
  | MindmapDoc
  | GitDoc
  | JourneyDoc;

export interface ParseOptions {
  readonly file?: string;
  readonly line?: number;
}

export type { ClassDoc, ErDoc, GanttDoc, GitDoc, JourneyDoc, MindmapDoc, PieDoc };
