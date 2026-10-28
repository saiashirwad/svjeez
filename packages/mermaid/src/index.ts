import {
  flowchart,
  sequence,
  stateMachine,
  type Flowchart,
  type FlowchartOptions,
  type NodeRole,
  type Sequence,
  type SequenceOptions,
  type StateMachine,
  type StateOptions,
  type StateSpec,
} from "svjeez/extras";
import { parse } from "./parse.ts";
import type { FlowchartDoc, FlowForm, SequenceDoc, StateDoc, StateNode } from "./types.ts";

export { MermaidSyntaxError } from "./errors.ts";

export { parse } from "./parse.ts";

export type * from "./types.ts";

/** The options of all three diagrams; each kind reads its own and ignores the rest. */
export type MermaidOptions = FlowchartOptions & SequenceOptions & StateOptions;

export type MermaidFlowchart = Flowchart<string, string> & {
  readonly kind: "flowchart";
  readonly doc: FlowchartDoc;
};

export type MermaidSequence = Sequence<string> & {
  readonly kind: "sequence";
  readonly doc: SequenceDoc;
};

export type MermaidState = StateMachine<string> & {
  readonly kind: "state";
  readonly doc: StateDoc;
};

/** A svjeez diagram plus the `kind` it was drawn as and the `doc` it was drawn from. Narrow on `kind`. */
export type MermaidDiagram = MermaidFlowchart | MermaidSequence | MermaidState;

/** Which svjeez node role draws each Mermaid form. */
export const FORM_ROLES: Record<FlowForm, NodeRole> = {
  rect: "task",
  round: "task",
  stadium: "input",
  diamond: "decision",
  circle: "output",
  subroutine: "tool",
  cylinder: "store",
};

const flow = (doc: FlowchartDoc, options: MermaidOptions): MermaidFlowchart => {
  const direction = options.direction ?? (doc.direction === "TD" ? "TB" : doc.direction);

  if (direction === "BT" || direction === "RL")
    throw new Error(
      `mermaid() cannot draw direction ${direction}: svjeez lays flowcharts out TB or LR. Write TD or LR, or pass { direction }.`,
    );

  const diagram = flowchart(
    {
      nodes: Object.fromEntries(
        doc.nodes.map((n) => [n.id, { label: n.label, role: FORM_ROLES[n.form] }]),
      ),
      groups: Object.fromEntries(
        doc.subgraphs.map((g) => [g.id, { label: g.title, nodes: g.nodes }]),
      ),
      edges: doc.edges.map((e) =>
        e.label === undefined
          ? ([e.from, e.to] as const)
          : ([e.from, e.to, { label: e.label }] as const),
      ),
    },
    { ...options, direction },
  );

  return { ...diagram, kind: "flowchart", doc };
};

const sequenceOf = (doc: SequenceDoc, options: MermaidOptions): MermaidSequence => {
  const diagram = sequence(
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
          : ([m.from, m.to, m.text, { reply: m.line === "dashed" }] as const),
      ),
    },
    options,
  );

  return { ...diagram, kind: "sequence", doc };
};

const specOf = (n: StateNode): StateSpec => {
  if (n.inner)
    return {
      label: n.label,
      final: n.final,
      initial: n.inner.initial,
      states: Object.fromEntries(n.inner.states.map((s) => [s.id, specOf(s)])),
    };

  return n.final ? { label: n.label, final: true } : n.label;
};

const stateOf = (doc: StateDoc, options: MermaidOptions): MermaidState => {
  // SAFETY: the parser guarantees what Checked<> asks of the types: every composite's initial is one of its own states
  const diagram = stateMachine(
    {
      states: Object.fromEntries(doc.states.map((s) => [s.id, specOf(s)])),
      initial: doc.initial,
      transitions: doc.transitions.map((t) =>
        t.label === undefined ? ([t.from, t.to] as const) : ([t.from, t.to, t.label] as const),
      ),
    } as Parameters<typeof stateMachine<Record<string, StateSpec>>>[0],
    { ...options, direction: options.direction ?? doc.direction },
  );

  return { ...diagram, kind: "state", doc };
};

/**
 * Draws Mermaid text as a svjeez diagram: `flowchart`/`graph`, `sequenceDiagram` or `stateDiagram`. `options` are the
 * diagram's own: `theme`, `font`, `fontSize`, `x`, `y`, `anchor`, `direction` and `play`.
 */
export function mermaid(text: string, options: MermaidOptions = {}): MermaidDiagram {
  const doc = parse(text);

  switch (doc.kind) {
    case "flowchart":
      return flow(doc, options);
    case "sequence":
      return sequenceOf(doc, options);
    case "state":
      return stateOf(doc, options);
  }
}
