import type { Box, Scene, SceneNode, Source } from "../model/ir";
import { nodeName } from "../model/naming";
import type { Seconds } from "../model/time";
import {
  inside,
  movingAt,
  seconds,
  textOf,
  type Entry,
  type SampledFrame,
  type Stretch,
} from "./survey";

export const RULES = {
  "type-error": "TypeScript rejects the scene file: a value or prop has the wrong type.",
  "compile-error": "The scene threw while it was built.",
  "compile-warning": "An SVG file or string the scene was given carries a warning.",
  "never-visible": "A node can't be seen at any time: hidden, painting nothing, or covered.",
  "zero-size": "A node's geometry, text or image has no size at any time.",
  "off-canvas": "Outside the canvas at every time, or cut by its edge at rest.",
  "text-overflow": "Text past the canvas at rest, or a line wider than the width it wraps to.",
  overlap: "Two texts drawn over each other while both are fully shown.",
  "missing-glyph": "Characters the text's face has no glyph for.",
  "low-contrast": "Text or a thin line too close in color to the flat color behind it.",
  "loop-seam": "A looping scene jumps when it starts again.",
  "visible-at-zero": "Shown at 0s and cut straight back in, or filled while its stroke draws in.",
  "nothing-enters": "Everything is on screen from 0s and nothing ever enters.",
  "wasted-motion": "A value changes before the node is first seen, or after it is gone for good.",
  static: "Nothing in the scene moves, or a value changes only after the scene ends.",
  "moving-filter":
    "A filter that is redrawn every frame because its parameters or what it filters move.",
  "moving-box": "A group placed by at or an anchor whose box moves, so the pin only holds at 0s.",
  "layout-overlap": "Two children of a <Stack> or <Grid> overlap: motion carried one onto another.",
  "word-cut": "A word wider than the width its text wraps to, cut across two lines.",
  unsupported: "A feature the chosen backend can't draw.",
  approximate: "A feature the chosen backend draws differently from the model.",
} as const;

export type Code = keyof typeof RULES;

export type Severity = "error" | "warning" | "info";

export interface Related {
  readonly key: string;
  readonly source?: Source;
}

export interface Problem {
  readonly code: Code;
  readonly severity: Severity;
  readonly key: string;
  readonly source?: Source;
  readonly message: string;
  readonly fix: string;
  readonly times?: readonly Seconds[];
  readonly related?: readonly Related[];
}

export interface Survey {
  readonly scene: Scene;
  readonly entries: readonly Entry[];
  readonly sources: ReadonlyMap<string, Source>;
  readonly frames: readonly SampledFrame[];
  readonly hidden: ReadonlyMap<string, readonly Stretch[]>;
  readonly gone: ReadonlySet<string>;
  readonly out: Problem[];
}

export const label = (node: SceneNode): string => nodeName(node);

export const spoken = (node: SceneNode, length = 40): string =>
  node.kind !== "text" || /^\d+$/.test(node.key.split("/").at(-1) ?? "")
    ? label(node)
    : `${label(node)} ("${short(textOf(node), length)}")`;

export const VISIBLE = 0.05;

export const shownBoxes = (
  survey: Survey,
  entry: Entry,
): { readonly t: Seconds; readonly box: Box }[] => {
  const { key } = entry.node;
  const hidden = survey.hidden.get(key) ?? [];

  return survey.frames.flatMap(({ t, frame }) => {
    const at = frame.get(key);

    return at && at.opacity > VISIBLE && !inside(hidden, t) ? [{ t, box: at.box }] : [];
  });
};

export const add = (
  survey: Survey,
  finding: Omit<Problem, "related"> & { readonly related?: readonly string[] },
): void => {
  const source = finding.source ?? survey.sources.get(finding.key);
  const { related, ...rest } = finding;

  survey.out.push({
    ...rest,
    ...(source && { source }),
    ...(related &&
      related.length > 0 && {
        related: related.map((key): Related => {
          const at = survey.sources.get(key);

          return at ? { key, source: at } : { key };
        }),
      }),
  });
};

export const isGone = (survey: Survey, entry: Entry): boolean =>
  [...entry.ancestors, entry.node].some((node) => survey.gone.has(node.key));

export const isLeaf = (entry: Entry): boolean => entry.node.kind !== "group";

const short = (text: string, length = 40): string =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

export const fading = (entry: Entry, t: Seconds): boolean =>
  [...entry.ancestors, entry.node].some((node) =>
    node.layers.some((layer) => movingAt(layer.opacity, t) || movingAt(layer.scale, t)),
  );

export const list = (times: readonly Seconds[]): string => {
  const shown = times.slice(0, 4).map(seconds).join(", ");

  return times.length > 4 ? `${shown} and ${times.length - 4} more` : shown;
};
