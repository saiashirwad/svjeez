import type { Where } from "svjeez/tools";
import type { ArchitectureDoc } from "./architecture.ts";
import type { BlockDoc } from "./block.ts";
import type { C4Doc } from "./c4.ts";
import type { ClassDoc } from "./class.ts";
import type { ErDoc } from "./er.ts";
import type { GanttDoc } from "./gantt.ts";
import type { GitDoc } from "./git.ts";
import type { JourneyDoc } from "./journey.ts";
import type { KanbanDoc } from "./kanban.ts";
import type { MindmapDoc } from "./mindmap.ts";
import type { PacketDoc } from "./packet.ts";
import type { PieDoc } from "./pie.ts";
import type { QuadrantDoc } from "./quadrant.ts";
import type { XyChartDoc } from "./xychart.ts";
import type { TimelineDoc } from "./timeline.ts";
import type { SankeyDoc } from "./sankey.ts";
import type { RequirementDoc } from "./requirement.ts";
import type { RadarDoc } from "./radar.ts";
import type { TreemapDoc } from "./treemap.ts";

export type Place = NonNullable<Where["source"]>;

export type MermaidDirection = "TB" | "LR" | "BT" | "RL";

export type FlowForm =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "circle"
  | "doubleCircle"
  | "subroutine"
  | "cylinder"
  | "hexagon"
  | "parallelogram"
  | "parallelogramBack"
  | "trapezoid"
  | "trapezoidBack"
  | "asymmetric";

/** Per-node paint from `classDef`, `class`, `:::` and `style`. Colors are hex. */
export interface FlowStyle {
  readonly fill?: `#${string}`;
  readonly stroke?: `#${string}`;
  readonly color?: `#${string}`;
  readonly width?: number;
  readonly dash?: readonly number[];
}

export type FlowEnd = "none" | "arrow" | "circle" | "cross";

export interface MermaidFlowNode {
  readonly id: string;
  readonly label: string;
  readonly form: FlowForm;
  readonly style?: FlowStyle;
}

export interface MermaidFlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly line: "solid" | "dotted" | "thick" | "invisible";
  readonly head: FlowEnd;
  readonly tail: FlowEnd;
  /** From `linkStyle`. */
  readonly style?: Pick<FlowStyle, "stroke" | "width">;
}

export interface FlowSubgraph {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly string[];
}

export interface FlowchartDoc {
  readonly kind: "flowchart";
  readonly source: Place;
  readonly direction: "TD" | MermaidDirection;
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
  /** `+` on the arrow: the receiver gets an activation bar. */
  readonly activate: boolean;
  /** `-` on the arrow: the sender's innermost activation bar ends. */
  readonly deactivate: boolean;
}

export interface SequenceNote {
  readonly kind: "note";
  readonly actor: string;
  /** Set when the note spans from `actor` to this actor. */
  readonly to?: string;
  readonly side: "over" | "left" | "right";
  readonly text: string;
}

export interface SequenceActivation {
  readonly kind: "activate" | "deactivate";
  readonly actor: string;
}

/** `autonumber [start]` gives a number to the messages after it; `autonumber off` stops. */
export interface SequenceAutonumber {
  readonly kind: "autonumber";
  readonly start: number | false;
}

export interface SequenceSection {
  /** The text after `else`, `and` or `option`. */
  readonly label: string;
  readonly items: readonly SequenceItem[];
}

export interface MermaidSequenceBlock {
  readonly kind: "block";
  readonly block: "loop" | "alt" | "opt" | "par" | "critical" | "break" | "rect";
  readonly label: string;
  /** For `rect`: `#rrggbb` and how opaque it is. */
  readonly color?: `#${string}`;
  readonly opacity?: number;
  readonly items: readonly SequenceItem[];
  /** The `else`, `and` or `option` sections after the first. */
  readonly sections: readonly SequenceSection[];
}

export type SequenceItem =
  | MermaidSequenceMessage
  | SequenceNote
  | SequenceActivation
  | SequenceAutonumber
  | MermaidSequenceBlock;

export interface SequenceBox {
  readonly label?: string;
  readonly color?: `#${string}`;
  readonly opacity?: number;
  readonly actors: readonly string[];
}

export interface SequenceDoc {
  readonly kind: "sequence";
  readonly source: Place;
  readonly title?: string;
  readonly participants: readonly MermaidParticipant[];
  readonly boxes: readonly SequenceBox[];
  readonly items: readonly SequenceItem[];
}

export type StateShape = "choice" | "fork" | "join";

export interface StateRegion {
  readonly initial: string;
  readonly states: readonly StateNode[];
}

export interface StateNode {
  readonly id: string;
  readonly label: string;
  readonly final: boolean;
  readonly shape?: StateShape;
  readonly detail?: readonly string[];
  /** The first region; `parallel` holds the regions after a `--`. */
  readonly inner?: StateRegion & {
    readonly direction?: "TB" | "LR";
    readonly parallel?: readonly StateRegion[];
  };
}

export interface StateNote {
  readonly of: string;
  readonly side: "left" | "right";
  readonly text: string;
}

export interface MermaidStateTransition {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface StateDoc {
  readonly kind: "state";
  readonly source: Place;
  readonly direction?: MermaidDirection;
  readonly initial: string;
  readonly states: readonly StateNode[];
  readonly transitions: readonly MermaidStateTransition[];
  readonly notes?: readonly StateNote[];
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
  | JourneyDoc
  | TimelineDoc
  | QuadrantDoc
  | XyChartDoc
  | SankeyDoc
  | BlockDoc
  | ArchitectureDoc
  | RequirementDoc
  | C4Doc
  | KanbanDoc
  | PacketDoc
  | PacketDoc
  | RadarDoc
  | TreemapDoc;

export interface ParseOptions {
  readonly file?: string;
  readonly line?: number;
}

export type {
  ArchitectureDoc,
  BlockDoc,
  C4Doc,
  ClassDoc,
  ErDoc,
  GanttDoc,
  GitDoc,
  JourneyDoc,
  KanbanDoc,
  MindmapDoc,
  PacketDoc,
  PieDoc,
  QuadrantDoc,
  RequirementDoc,
  SankeyDoc,
  TimelineDoc,
  XyChartDoc,
  MindmapDoc,
  PacketDoc,
  PieDoc,
  RadarDoc,
  TreemapDoc,
};
