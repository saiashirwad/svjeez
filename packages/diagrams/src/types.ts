import type { Color } from "svjeez/tools";

export type Direction = "TB" | "LR" | "BT" | "RL";

export type NodeRole = "task" | "input" | "output" | "tool" | "decision" | "store";

/** An outline that a role does not imply: it changes the shape and keeps the role's color. */
export type NodeShape = "hexagon" | "slantBack" | "trapezoid" | "trapezoidBack" | "flag" | "double";

/** Per-node paint that replaces what the role would give. */
export interface NodeStyle {
  readonly fill?: Color;
  readonly stroke?: Color;
  readonly color?: Color;
  readonly width?: number;
  readonly dash?: readonly number[];
}

export type Labelled =
  | string
  | {
      readonly label: string;
      readonly role?: NodeRole;
      readonly shape?: NodeShape;
      readonly style?: NodeStyle;
    };

export type ArrowHead = "filled" | "none" | "cross" | "async" | "circle";

export interface FlowchartEdgeOptions {
  /** `invisible` takes part in the layout but is not drawn. */
  readonly line?: "solid" | "dotted" | "thick" | "invisible";
  readonly head?: "filled" | "none" | "cross" | "circle";
  readonly tail?: "filled" | "none" | "cross" | "circle";
  readonly color?: Color;
  readonly width?: number;
}

export type FlowchartEdge<N extends string> =
  | readonly [from: N, to: N]
  | readonly [from: N, to: N, label: string]
  | readonly [from: N, to: N, label: string | undefined, options: FlowchartEdgeOptions];

export interface FlowchartGroup<N extends string> {
  readonly label: string;
  readonly nodes: readonly N[];
}

export interface FlowchartSpec<N extends string = string> {
  readonly nodes: Readonly<Record<N, Labelled>>;
  readonly groups?: Readonly<Record<string, FlowchartGroup<N>>>;
  readonly edges: readonly FlowchartEdge<N>[];
}

export type SequenceMessage<A extends string> =
  | readonly [from: A, to: A, label: string]
  | readonly [
      from: A,
      to: A,
      label: string,
      options: { readonly reply?: boolean; readonly head?: ArrowHead },
    ]
  | { readonly note: A; readonly text: string };

export interface SequenceSpec<A extends string = string> {
  readonly actors: Readonly<Record<A, Labelled>>;
  readonly messages: readonly SequenceMessage<A>[];
}

export interface StateRegion {
  readonly states: Readonly<Record<string, StateSpec>>;
  readonly initial: string;
}

export type StateSpec =
  | string
  | {
      readonly label: string;
      readonly final?: boolean;
      readonly role?: NodeRole;
      /** Description lines drawn under the name. */
      readonly detail?: readonly string[];
    }
  /** A small diamond ("choice") or a thick bar ("bar", for a fork or join). */
  | { readonly kind: "choice" | "bar" }
  | {
      readonly label: string;
      readonly final?: boolean;
      readonly role?: NodeRole;
      readonly states: Readonly<Record<string, StateSpec>>;
      readonly initial: string;
      readonly direction?: Direction;
      /** Concurrent regions drawn after this one, each with its own states and start. */
      readonly parallel?: readonly StateRegion[];
    };

export interface StateNote<S extends string = string> {
  readonly of: S;
  readonly text: string;
  /** Beside the state; in an LR machine "left" is above it and "right" below. Defaults to "right". */
  readonly side?: "left" | "right";
}

export type StateTransition<S extends string> =
  | readonly [from: S, to: S]
  | readonly [from: S, to: S, label: string];

export interface StateMachineSpec {
  readonly states: Readonly<Record<string, StateSpec>>;
  readonly initial: string;
  readonly transitions: readonly StateTransition<string>[];
  readonly notes?: readonly StateNote[];
}

export type TreeSpec<N extends string> =
  | string
  | { readonly label: string; readonly parent?: N; readonly role?: NodeRole };

export interface LaneBar<L extends string> {
  readonly lane: L;
  readonly at: number;
  readonly over: number;
  readonly label?: string;
  readonly role?: NodeRole;
}

export interface LaneEvent<L extends string> {
  readonly lane: L;
  readonly at: number;
  readonly label?: string;
  readonly role?: NodeRole;
}

export interface LaneLink<L extends string> {
  readonly from: L;
  readonly to: L;
  readonly at: number;
}

export interface LanesSpec<L extends string = string> {
  readonly lanes: Readonly<Record<L, Labelled>>;
  readonly spans?: readonly LaneBar<L>[];
  readonly events?: readonly LaneEvent<L>[];
  readonly links?: readonly LaneLink<L>[];
}
