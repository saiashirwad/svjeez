import type { Animated, Paint, Scene, SceneNode, TextNode, TextRun } from "../model/ir";
import { isCurved } from "../model/curve";
import { isLane } from "../model/lane";

export type Feature =
  | "text"
  | "outlinedText"
  | "image"
  | "instance"
  | "clip"
  | "mask"
  | "blur"
  | "shadow"
  | "linearGradient"
  | "radialGradient"
  | "nonScalingStroke"
  | "liveTokens"
  | "curvedMotion"
  | "movingDashedTrim";

export type Support =
  | { readonly level: "exact" }
  | { readonly level: "close"; readonly note: string }
  | { readonly level: "none"; readonly note: string };

export interface Diagnostic {
  readonly severity: "error" | "warning";
  readonly feature: Feature;
  readonly key: string;
  readonly message: string;
}

export interface Backend<Out, Options = {}> {
  readonly name: string;
  readonly supports: Readonly<Record<Feature, Support>>;
  emit(
    scene: Scene,
    options?: Options & { readonly onWarning?: (warning: Diagnostic) => void },
  ): Out;
}

const paints = (paint: Animated<Paint> | undefined): Paint[] => {
  if (paint === undefined) return [];

  return isLane(paint) ? paint.keys.map((key) => key.value) : [paint];
};

const runsOf = (node: TextNode): TextRun[] => node.lines.flatMap((line) => line.runs);

const featuresOf = (node: SceneNode): Feature[] => {
  const used: Feature[] = [];

  const painted = [
    ...(node.kind === "shape" ? [...paints(node.fill), ...paints(node.stroke?.color)] : []),
    ...(node.kind === "text" ? runsOf(node).flatMap((run) => paints(run.fill)) : []),
  ];

  if (node.kind === "text")
    used.push(runsOf(node).every((run) => run.outline) ? "text" : "outlinedText");

  if (node.kind === "image" || node.kind === "instance") used.push(node.kind);

  if (node.clip) used.push("clip");

  if (node.mask) used.push("mask");

  for (const effect of node.effects) used.push(effect.kind);

  for (const paint of painted) {
    if (Array.isArray(paint)) continue;

    if ("kind" in paint) used.push(paint.kind === "token" ? "liveTokens" : `${paint.kind}Gradient`);
  }

  if (node.kind === "shape" && node.stroke?.nonScaling) used.push("nonScalingStroke");

  if (
    node.kind === "shape" &&
    node.stroke?.dash !== undefined &&
    node.stroke.cap !== "butt" &&
    node.trim !== undefined &&
    (isLane(node.trim) || isLane(node.geometry))
  )
    used.push("movingDashedTrim");

  if (
    [node.at, ...node.layers.map((layer) => layer.offset)].some(
      (at) => isLane(at) && isCurved(at.keys),
    )
  )
    used.push("curvedMotion");

  return [...new Set(used)];
};

export const diagnose = (
  scene: Scene,
  backend: Pick<Backend<never>, "name" | "supports">,
): Diagnostic[] => {
  const out: Diagnostic[] = [];

  const visit = (node: SceneNode): void => {
    for (const feature of featuresOf(node)) {
      const support = backend.supports[feature];

      if (support.level === "exact") continue;

      out.push({
        severity: support.level === "none" ? "error" : "warning",
        feature,
        key: node.key,
        message: `"${node.key}" uses ${feature}, which ${backend.name} ${support.level === "none" ? "can't draw" : "draws differently"}: ${support.note}`,
      });
    }

    if (node.kind === "group") node.children.forEach(visit);

    if (node.mask) visit(node.mask);
  };

  visit(scene.root);
  Object.values(scene.symbols).forEach(visit);

  return out;
};

export const admit = (
  scene: Scene,
  backend: Pick<Backend<never>, "name" | "supports">,
  onWarning?: (warning: Diagnostic) => void,
): void => {
  const found = diagnose(scene, backend);
  const errors = found.filter((entry) => entry.severity === "error");

  if (errors.length > 0) throw new Error(errors.map((entry) => entry.message).join("\n"));

  if (onWarning) found.forEach(onWarning);
};
