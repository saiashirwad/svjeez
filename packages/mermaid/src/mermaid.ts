import {
  flowchart,
  sequence,
  stateMachine,
  type ClassDiagram,
  type Diagram,
  type DiagramOptions,
  type ErDiagram,
  type Gantt,
  type GitGraph,
  type Journey,
  type Mindmap,
  type Pie,
  type Timeline,
  type Flowchart,
  type NodeRole,
  type NodeShape,
  type Sequence,
  type SequenceMessage,
  type StateMachine,
  type StateSpec,
  type StateTransition,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { SceneError } from "svjeez/tools";
import { drawClass } from "./class.ts";
import { drawEr } from "./er.ts";
import { drawGantt } from "./gantt.ts";
import { drawGit } from "./git.ts";
import { drawJourney } from "./journey.ts";
import { drawMindmap } from "./mindmap.ts";
import { parseMermaid } from "./parse.ts";
import { drawPie } from "./pie.ts";
import { drawTimeline } from "./timeline.ts";
import type {
  ClassDoc,
  ErDoc,
  FlowchartDoc,
  GanttDoc,
  GitDoc,
  JourneyDoc,
  MindmapDoc,
  PieDoc,
  TimelineDoc,
  FlowForm,
  MermaidDirection,
  MermaidDoc,
  ParseOptions,
  SequenceDoc,
  SequenceItem,
  StateDoc,
  StateNode,
  StateRegion,
} from "./types.ts";

export interface MermaidOptions extends DiagramOptions, ParseOptions {
  readonly direction?: MermaidDirection;
  readonly reveal?: Span;
}

export type MermaidDiagram =
  | (Flowchart<string, string> & { readonly kind: "flowchart"; readonly doc: FlowchartDoc })
  | (Sequence<string> & { readonly kind: "sequence"; readonly doc: SequenceDoc })
  | (StateMachine<string> & { readonly kind: "state"; readonly doc: StateDoc })
  | (ClassDiagram<string, string> & { readonly kind: "class"; readonly doc: ClassDoc })
  | (ErDiagram<string> & { readonly kind: "er"; readonly doc: ErDoc })
  | (Gantt & { readonly kind: "gantt"; readonly doc: GanttDoc })
  | (Journey & { readonly kind: "journey"; readonly doc: JourneyDoc })
  | (Pie<string> & { readonly kind: "pie"; readonly doc: PieDoc })
  | (Mindmap<string> & { readonly kind: "mindmap"; readonly doc: MindmapDoc })
  | (GitGraph & { readonly kind: "git"; readonly doc: GitDoc })
  | (Timeline & { readonly kind: "timeline"; readonly doc: TimelineDoc });

const FORM_NODES: Record<FlowForm, { readonly role: NodeRole; readonly shape?: NodeShape }> = {
  rect: { role: "task" },
  round: { role: "task" },
  stadium: { role: "input" },
  diamond: { role: "decision" },
  circle: { role: "output" },
  doubleCircle: { role: "output", shape: "double" },
  subroutine: { role: "tool" },
  cylinder: { role: "store" },
  hexagon: { role: "tool", shape: "hexagon" },
  parallelogram: { role: "input" },
  parallelogramBack: { role: "input", shape: "slantBack" },
  trapezoid: { role: "task", shape: "trapezoid" },
  trapezoidBack: { role: "task", shape: "trapezoidBack" },
  asymmetric: { role: "input", shape: "flag" },
};

const HEADS = { none: "none", arrow: "filled", circle: "circle", cross: "cross" } as const;

const NAMES = {
  sequence: "sequence diagram",
  gantt: "gantt chart",
  journey: "user journey",
  pie: "pie chart",
  mindmap: "mindmap",
  git: "git graph",
  timeline: "timeline",
} as const;

const stateRegion = (r: StateRegion) => ({
  initial: r.initial,
  states: Object.fromEntries(r.states.map((s) => [s.id, stateSpec(s)])),
});

const sequenceMessages = (items: readonly SequenceItem[]): SequenceMessage<string>[] =>
  items.map((m): SequenceMessage<string> => {
    switch (m.kind) {
      case "note":
        return {
          note: m.to === undefined ? m.actor : [m.actor, m.to],
          text: m.text,
          ...(m.side !== "over" && { side: m.side }),
        };
      case "activate":
        return { activate: m.actor };
      case "deactivate":
        return { deactivate: m.actor };
      case "autonumber":
        return { autonumber: m.start };
      case "block":
        return {
          block: m.block,
          label: m.label,
          color: m.color,
          opacity: m.opacity,
          messages: sequenceMessages(m.items),
          sections: m.sections.map((x) => ({
            label: x.label,
            messages: sequenceMessages(x.items),
          })),
        };
      case "message":
        return [
          m.from,
          m.to,
          m.text,
          { reply: m.reply, head: m.head, activate: m.activate, deactivate: m.deactivate },
        ];
    }
  });

const stateSpec = (n: StateNode): StateSpec => {
  if (n.shape) return { kind: n.shape === "choice" ? "choice" : "bar" };

  if (n.inner) {
    const { direction, parallel, ...first } = n.inner;

    return {
      label: n.label,
      final: n.final,
      ...stateRegion(first),
      ...(direction && { direction }),
      ...(parallel && { parallel: parallel.map(stateRegion) }),
    };
  }

  if (n.detail) return { label: n.label, final: n.final, detail: n.detail };

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

    return drawn(
      flowchart(
        {
          nodes: Object.fromEntries(
            doc.nodes.map((n) => [n.id, { label: n.label, ...FORM_NODES[n.form], style: n.style }]),
          ),
          groups: Object.fromEntries(
            doc.subgraphs.map((g) => [g.id, { label: g.title, nodes: g.nodes }]),
          ),
          edges: doc.edges.map(
            (e) =>
              [
                e.from,
                e.to,
                e.label,
                {
                  line: e.line,
                  head: HEADS[e.head],
                  tail: HEADS[e.tail],
                  color: e.style?.stroke,
                  width: e.style?.width,
                },
              ] as const,
          ),
        },
        { ...diagramOptions, direction },
      ),
      "flowchart",
      doc,
    );
  }

  if (doc.kind === "class")
    return drawn(drawClass(doc, { ...diagramOptions, direction: asked }), "class", doc);

  if (doc.kind === "er")
    return drawn(drawEr(doc, { ...diagramOptions, direction: asked }), "er", doc);

  if (doc.kind !== "state" && asked)
    throw new SceneError(
      `A ${NAMES[doc.kind]} has no direction.`,
      "Drop { direction } from mermaid().",
      { source: doc.source },
    );

  if (doc.kind === "gantt") return drawn(drawGantt(doc, diagramOptions), "gantt", doc);

  if (doc.kind === "journey") return drawn(drawJourney(doc, diagramOptions), "journey", doc);

  if (doc.kind === "pie") return drawn(drawPie(doc, diagramOptions), "pie", doc);

  if (doc.kind === "mindmap") return drawn(drawMindmap(doc, diagramOptions), "mindmap", doc);

  if (doc.kind === "git") return drawn(drawGit(doc, diagramOptions), "git", doc);

  if (doc.kind === "timeline") return drawn(drawTimeline(doc, diagramOptions), "timeline", doc);

  if (doc.kind === "sequence") {
    return drawn(
      sequence(
        {
          actors: Object.fromEntries(
            doc.participants.map((p) => [
              p.id,
              { label: p.label, role: p.role === "actor" ? "input" : "task" } as const,
            ]),
          ),
          messages: sequenceMessages(doc.items),
          title: doc.title,
          boxes: doc.boxes,
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
    stateMachine<Record<string, StateSpec>, readonly StateTransition<string>[]>(
      {
        states: Object.fromEntries(doc.states.map((s) => [s.id, stateSpec(s)])),
        initial: doc.initial,
        transitions: doc.transitions.map((t) =>
          t.label === undefined ? ([t.from, t.to] as const) : ([t.from, t.to, t.label] as const),
        ),
        notes: doc.notes,
      },
      { ...stateOptions, direction: asked ?? doc.direction },
    ),
    "state",
    doc,
  );
}
