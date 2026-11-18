import type { Animated, Paint, Scene, SceneNode, Source, TextNode, TextRun } from "./ir";
import { nodeName } from "./naming";
import { SceneError } from "./scene-error";
import { isCurved } from "./curve";
import { isLane } from "./lane";
import { walkScene } from "./walk";

export type Feature =
  | "text"
  | "unoutlinedText"
  | "image"
  | "instance"
  | "clip"
  | "mask"
  | "blur"
  | "shadow"
  | "softBlur"
  | "linearGradient"
  | "radialGradient"
  | "nonScalingStroke"
  | "liveTokens"
  | "curvedMotion"
  | "movingDashedTrim";

export const FEATURES: Readonly<Record<Feature, string>> = {
  text: "text",
  unoutlinedText: "text in a font svjeez can't outline",
  image: "a picture",
  instance: "a symbol",
  clip: "a clip",
  mask: "a mask",
  blur: "a blur",
  shadow: "a shadow",
  softBlur: "a blur under 1.5 units",
  linearGradient: "a linear gradient",
  radialGradient: "a radial gradient",
  nonScalingStroke: "a stroke that keeps its width when scaled",
  liveTokens: "light and dark colors",
  curvedMotion: "a curved path of motion",
  movingDashedTrim: "a dashed stroke trimmed while it moves",
};

export type Support =
  | { readonly level: "exact" }
  | { readonly level: "close"; readonly note: string }
  | { readonly level: "none"; readonly note: string };

export interface Diagnostic {
  readonly severity: "error" | "warning";
  readonly feature: Feature;
  readonly key: string;
  readonly message: string;
  readonly source?: Source;
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

const SOFT = 1.5;

const softens = (radius: Animated<number>): boolean => {
  const values = isLane(radius) ? radius.keys.map((key) => key.value) : [radius];

  return Math.min(...values) < SOFT && Math.max(...values) > 0;
};

const runsOf = (node: TextNode): TextRun[] => node.lines.flatMap((line) => line.runs);

const featuresOf = (node: SceneNode): Feature[] => {
  const used: Feature[] = [];

  const painted = [
    ...(node.kind === "shape" ? [...paints(node.fill), ...paints(node.stroke?.color)] : []),
    ...(node.kind === "text" ? runsOf(node).flatMap((run) => paints(run.fill)) : []),
  ];

  if (node.kind === "text") {
    used.push("text");

    if (runsOf(node).some((run) => !run.outline)) used.push("unoutlinedText");
  }

  if (node.kind === "image" || node.kind === "instance") used.push(node.kind);

  if (node.clip) used.push("clip");

  if (node.mask) used.push("mask");

  for (const effect of node.effects) {
    used.push(effect.kind);

    if (softens(effect.kind === "blur" ? effect.radius : effect.blur)) used.push("softBlur");
  }

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

  walkScene(scene, (node) => {
    for (const feature of featuresOf(node)) {
      const support = backend.supports[feature];

      if (support.level === "exact") continue;

      out.push({
        severity: support.level === "none" ? "error" : "warning",
        feature,
        key: node.key,
        message: `${nodeName(node)} uses ${FEATURES[feature]}, which ${backend.name} ${support.level === "none" ? "can't draw" : "draws differently"}: ${support.note}`,
        ...(node.source && { source: node.source }),
      });
    }
  });

  return out;
};

export const admit = (
  scene: Scene,
  backend: Pick<Backend<never>, "name" | "supports">,
  onWarning?: (warning: Diagnostic) => void,
): void => {
  const found = diagnose(scene, backend);
  const errors = found.filter((entry) => entry.severity === "error");

  const [first] = errors;

  if (first)
    throw new SceneError(errors.map((entry) => entry.message).join("\n"), undefined, {
      key: first.key,
      ...(first.source && { source: first.source }),
    });

  if (onWarning) found.forEach(onWarning);
};
