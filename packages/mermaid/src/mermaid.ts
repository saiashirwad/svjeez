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
  type Flowchart,
  type NodeRole,
  type Sequence,
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
import type {
  ClassDoc,
  ErDoc,
  FlowchartDoc,
  GanttDoc,
  GitDoc,
  JourneyDoc,
  MindmapDoc,
  PieDoc,
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
  | (StateMachine<string> & { readonly kind: "state"; readonly doc: StateDoc })
  | (ClassDiagram<string, string> & { readonly kind: "class"; readonly doc: ClassDoc })
  | (ErDiagram<string> & { readonly kind: "er"; readonly doc: ErDoc })
  | (Gantt & { readonly kind: "gantt"; readonly doc: GanttDoc })
  | (Journey & { readonly kind: "journey"; readonly doc: JourneyDoc })
  | (Pie<string> & { readonly kind: "pie"; readonly doc: PieDoc })
  | (Mindmap<string> & { readonly kind: "mindmap"; readonly doc: MindmapDoc })
  | (GitGraph & { readonly kind: "git"; readonly doc: GitDoc });

const FORM_ROLES: Record<FlowForm, NodeRole> = {
  rect: "task",
  round: "task",
  stadium: "input",
  diamond: "decision",
  circle: "output",
  subroutine: "tool",
  cylinder: "store",
};

const NAMES = {
  sequence: "sequence diagram",
  gantt: "gantt chart",
  journey: "user journey",
  pie: "pie chart",
  mindmap: "mindmap",
  git: "git graph",
} as const;

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
          messages: doc.items.map((m) =>
            m.kind === "note"
              ? { note: m.actor, text: m.text }
              : ([m.from, m.to, m.text, { reply: m.reply, head: m.head }] as const),
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
    stateMachine<Record<string, StateSpec>, readonly StateTransition<string>[]>(
      {
        states: Object.fromEntries(doc.states.map((s) => [s.id, stateSpec(s)])),
        initial: doc.initial,
        transitions: doc.transitions.map((t) =>
          t.label === undefined ? ([t.from, t.to] as const) : ([t.from, t.to, t.label] as const),
        ),
      },
      { ...stateOptions, direction: asked ?? doc.direction },
    ),
    "state",
    doc,
  );
}
