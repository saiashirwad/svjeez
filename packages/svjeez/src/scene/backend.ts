import type { Animated, Paint, Scene, SceneNode } from "./ir";
import { isLane } from "./lane";

/** Everything in a scene that some target might not draw. A new node kind, paint or effect adds a name here. */
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
  | "liveTokens";

/**
 * How a backend handles a feature. `exact` draws it as the model says. `close` draws something a viewer can tell
 * apart, and says how in `note`. `none` can't draw it.
 */
export type Support =
  | { readonly level: "exact" }
  | { readonly level: "close"; readonly note: string }
  | { readonly level: "none"; readonly note: string };

export interface Diagnostic {
  /** `none` is an error, `close` a warning. */
  readonly severity: "error" | "warning";
  readonly feature: Feature;
  /** The key of the node that uses it. */
  readonly key: string;
  readonly message: string;
}

export interface Backend<Out, Options = {}> {
  readonly name: string;
  readonly supports: Readonly<Record<Feature, Support>>;
  /** Throws on any feature the backend can't draw, naming the node. Each `close` one goes to `onWarning`. */
  emit(
    scene: Scene,
    options?: Options & { readonly onWarning?: (warning: Diagnostic) => void },
  ): Out;
}

const paints = (paint: Animated<Paint> | undefined): Paint[] => {
  if (paint === undefined) return [];

  return isLane(paint) ? paint.keys.map((key) => key.value) : [paint];
};

const featuresOf = (node: SceneNode): Feature[] => {
  const used: Feature[] = [];

  const painted = [
    ...(node.kind === "shape" ? [...paints(node.fill), ...paints(node.stroke?.color)] : []),
    ...(node.kind === "text" ? paints(node.fill) : []),
  ];

  if (node.kind === "text")
    used.push(node.lines.every((line) => line.outline) ? "text" : "outlinedText");

  if (node.kind === "image" || node.kind === "instance") used.push(node.kind);

  if (node.clip) used.push("clip");

  if (node.mask) used.push("mask");

  for (const effect of node.effects) used.push(effect.kind);

  for (const paint of painted) {
    if (Array.isArray(paint)) continue;

    if ("kind" in paint) used.push(paint.kind === "token" ? "liveTokens" : `${paint.kind}Gradient`);
  }

  if (node.kind === "shape" && node.stroke?.nonScaling) used.push("nonScalingStroke");

  return [...new Set(used)];
};

/** What `backend` can't draw exactly in `scene`, without emitting anything. */
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

/** Runs `diagnose` for an `emit`: throws the errors together and hands on the warnings. */
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
