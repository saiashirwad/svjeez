import {
  flowchart,
  sequence,
  stateMachine,
  type Diagram,
  type DiagramOptions,
  type Flowchart,
  type NodeRole,
  type Sequence,
  type StateMachine,
  type StateSpec,
  type StateTransition,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { SceneError } from "svjeez/tools";
import { parseMermaid } from "./parse.ts";
import type {
  FlowchartDoc,
  FlowForm,
  MermaidDoc,
  ParseOptions,
  SequenceDoc,
  StateDoc,
  StateNode,
} from "./types.ts";

export interface MermaidOptions extends DiagramOptions, ParseOptions {
  readonly direction?: "TB" | "LR";
  readonly reveal?: Span;
}

export type MermaidDiagram =
  | (Flowchart<string, string> & { readonly kind: "flowchart"; readonly doc: FlowchartDoc })
  | (Sequence<string> & { readonly kind: "sequence"; readonly doc: SequenceDoc })
  | (StateMachine<string> & { readonly kind: "state"; readonly doc: StateDoc });

const FORM_ROLES: Record<FlowForm, NodeRole> = {
  rect: "task",
  round: "task",
  stadium: "input",
  diamond: "decision",
  circle: "output",
  subroutine: "tool",
  cylinder: "store",
};

const stateSpec = (n: StateNode): StateSpec => {
  if (n.inner)
    return {
      label: n.label,
      final: n.final,
      initial: n.inner.initial,
      states: Object.fromEntries(n.inner.states.map((s) => [s.id, stateSpec(s)])),
    };

  return n.final ? { label: n.label, final: true } : n.label;
};

const drawn = <D extends Diagram<string>, K extends string, T extends MermaidDoc>(
  diagram: D,
  kind: K,
  doc: T,
) => ({ ...diagram, kind, doc });

export function mermaid(text: string, options: MermaidOptions): MermaidDiagram {
  const { file, line, direction: asked, ...diagramOptions } = options;
  const doc = parseMermaid(text, { file, line });

  if (doc.kind === "flowchart") {
    const direction = asked ?? (doc.direction === "TD" ? "TB" : doc.direction);

    if (direction === "BT" || direction === "RL")
      throw new SceneError(
        `The flowchart is written ${direction}, and svjeez lays flowcharts out top to bottom or left to right.`,
        "Write TD or LR in the Mermaid text, or pass { direction }.",
        { source: doc.source },
      );

    return drawn(
      flowchart(
        {
          nodes: Object.fromEntries(
            doc.nodes.map((n) => [n.id, { label: n.label, role: FORM_ROLES[n.form] }]),
          ),
          groups: Object.fromEntries(
            doc.subgraphs.map((g) => [g.id, { label: g.title, nodes: g.nodes }]),
          ),
          edges: doc.edges.map(
            (e) =>
              [e.from, e.to, e.label, { line: e.line, head: e.arrow ? "filled" : "none" }] as const,
          ),
        },
        { ...diagramOptions, direction },
      ),
      "flowchart",
      doc,
    );
  }

  if (doc.kind === "sequence") {
    if (asked)
      throw new SceneError(
        "A sequence diagram has no direction.",
        "Drop { direction } from mermaid().",
        { source: doc.source },
      );

    return drawn(
      sequence(
        {
          actors: Object.fromEntries(
            doc.participants.map((p) => [
              p.id,
              { label: p.label, role: p.role === "actor" ? "input" : "task" } as const,
            ]),
          ),
          messages: doc.items.map((m) =>
            m.kind === "note"
              ? { note: m.actor, text: m.text }
              : ([m.from, m.to, m.text, { reply: m.line === "dashed", head: m.head }] as const),
          ),
        },
        diagramOptions,
      ),
      "sequence",
      doc,
    );
  }

  if (diagramOptions.reveal)
    throw new SceneError(
      "A state diagram has no reveal.",
      "Drop { reveal } from mermaid(), and walk the machine with its walk() instead.",
      { source: doc.source },
    );
  const { reveal: _, ...stateOptions } = diagramOptions;

  return drawn(
    // SAFETY: the parser guarantees every composite's initial is one of its own states
    stateMachine(
      {
        states: Object.fromEntries(doc.states.map((s) => [s.id, stateSpec(s)])),
        initial: doc.initial,
        transitions: doc.transitions.map((t) =>
          t.label === undefined ? ([t.from, t.to] as const) : ([t.from, t.to, t.label] as const),
        ),
      } as Parameters<
        typeof stateMachine<Record<string, StateSpec>, readonly StateTransition<string>[]>
      >[0],
      { ...stateOptions, direction: asked ?? doc.direction },
    ),
    "state",
    doc,
  );
}
