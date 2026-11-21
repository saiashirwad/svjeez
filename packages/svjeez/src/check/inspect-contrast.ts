import type { Animated, Box, Paint, Rgba, Scene, SceneNode } from "../model/ir";
import { isLane } from "../model/lane";
import type { Seconds } from "../model/time";
import type { Placed } from "./boxes";
import { add, fading, isGone, isLeaf, label, spoken, type Survey } from "./inspect-context";
import { flatAt, type Flat } from "./inspect-visibility";
import {
  between,
  clearThroughout,
  colorAt,
  inside,
  movingAt,
  paintName,
  runsOf,
  scaleOf,
  schemesOf,
  sharedArea,
  type Entry,
  type Scheme,
} from "./survey";

const luminance = ([r, g, b]: Rgba): number => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a: Rgba, b: Rgba): number => {
  const [x, y] = [luminance(a), luminance(b)];

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const over = (top: Rgba, alpha: number, under: Rgba): Rgba => {
  const a = top[3] * alpha;
  const mix = (i: 0 | 1 | 2) => top[i] * a + under[i] * (1 - a);

  return [mix(0), mix(1), mix(2), 1];
};

const behind = (
  survey: Survey,
  entry: Entry,
  frame: ReadonlyMap<string, Placed>,
  box: Box,
  t: Seconds,
  scheme: Scheme,
): { readonly key: string; readonly flat: Flat } | undefined => {
  for (let i = entry.order - 1; i > 0; i--) {
    const under = survey.entries[i]!;

    if (!isLeaf(under) || survey.gone.has(under.node.key) || !schemesOf(under).includes(scheme))
      continue;
    const at = frame.get(under.node.key);

    if (!at || at.opacity <= 1e-3 || inside(survey.hidden.get(under.node.key) ?? [], t)) continue;

    if (sharedArea(at.box, box) <= 0) continue;
    const flat = flatAt(survey, under, at, t, box);

    return flat && { key: under.node.key, flat };
  }

  return undefined;
};

interface Contrast {
  readonly ratio: number;
  readonly scheme: Scheme;
  /** The ratio in the other scheme, when the node shows in both. */
  readonly other?: number;
  readonly color: string;
  readonly under: string;
  readonly key: string;
}

export const lowContrast = (survey: Survey): void => {
  const { scene } = survey;

  for (const entry of survey.entries) {
    const { node } = entry;

    if (isGone(survey, entry)) continue;
    const paints = paintsOf(scene, node);

    if (paints.length === 0) continue;
    const schemes = schemesOf(entry);
    let worst: Contrast | undefined;
    const low: Seconds[] = [];
    let need = 0;

    survey.frames.forEach(({ t, frame }) => {
      const at = frame.get(node.key);

      if (
        !at ||
        at.opacity < 0.99 ||
        fading(entry, t) ||
        inside(survey.hidden.get(node.key) ?? [], t)
      )
        return;
      const { box } = at;

      const backs = schemes.flatMap((scheme) => {
        const back = behind(survey, entry, frame, box, t, scheme);

        return back ? [{ scheme, back }] : [];
      });

      if (backs.length === 0) return;
      const size = node.kind === "text" ? node.size * scaleOf(at.matrix) : 0;
      const bold = node.kind === "text" && runsOf(node).every((run) => run.face.weight >= 700);

      const threshold =
        node.kind === "text" ? (size >= 24 || (bold && size >= 18.66) ? 3 : 4.5) : 3;

      let found: Contrast | undefined;

      for (const { paint, alpha, steady } of paints) {
        if (movingAt(paint, t) || !steady(t) || alpha(t) < 0.99) continue;

        const by = backs
          .flatMap(({ scheme, back }) => {
            const color = colorAt(scene, paint, t, scheme);
            const under = back.flat.color[scheme];

            return color
              ? [{ scheme, back, value: ratio(over(color, alpha(t), under), under) }]
              : [];
          })
          .sort((a, b) => a.value - b.value);

        const [lo, hi] = by;

        if (!lo || by.length < backs.length) continue;
        const value = between(paint, t);

        if (!found || lo.value < found.ratio)
          found = {
            ratio: lo.value,
            scheme: lo.scheme,
            ...(hi && { other: hi.value }),
            color: paintName(value.amount >= 0.5 ? value.to : value.from),
            under: lo.back.flat.name,
            key: lo.back.key,
          };
      }

      if (!found || found.ratio >= threshold) return;
      low.push(t);
      need = Math.max(need, threshold);

      if (!worst || found.ratio < worst.ratio) worst = found;
    });

    if (!worst) continue;
    const text = node.kind === "text";
    const floor = text ? 3 : 1.5;

    const what = text ? `${spoken(node, 24)}` : `the stroke of ${label(node)}`;

    const other = worst.scheme === "light" ? "dark" : "light";
    const also = worst.other === undefined ? "" : ` (${worst.other.toFixed(2)}:1 in ${other})`;

    add(survey, {
      code: "low-contrast",
      severity: worst.ratio < floor ? "warning" : "info",
      key: node.key,
      message: `${what} is hard to see: ${worst.color} on ${worst.under} is ${worst.ratio.toFixed(2)}:1 in the ${worst.scheme} scheme${also}, under the ${need}:1 ${text ? "text this size needs" : "a thin line needs"}.`,
      fix: `Pick a ${text ? "fill" : "stroke color"} farther from ${worst.under} in ${schemes.length > 1 ? "both schemes" : `the ${worst.scheme} scheme`}${text ? ", or make the text larger" : ", or make the line wider"}.`,
      times: low,
      related: [worst.key],
    });
  }
};

const paintsOf = (
  scene: Scene,
  node: SceneNode,
): {
  readonly paint: Animated<Paint>;
  readonly alpha: (t: Seconds) => number;
  readonly steady: (t: Seconds) => boolean;
}[] => {
  if (node.kind === "text")
    return runsOf(node)
      .filter((run) => run.text.trim() !== "")
      .map((run) => ({
        paint: run.fill,
        alpha: (t: Seconds) => {
          if (run.opacity === undefined) return 1;
          const { from, to, amount } = between(run.opacity, t);

          return from + (to - from) * amount;
        },
        steady: (t: Seconds) => run.opacity === undefined || !movingAt(run.opacity, t),
      }));

  if (node.kind !== "shape" || !node.stroke || !clearThroughout(scene, node.fill)) return [];

  const width = isLane(node.stroke.width)
    ? Math.max(...node.stroke.width.keys.map((key) => key.value))
    : node.stroke.width;

  return width > 0 && width <= 2
    ? [{ paint: node.stroke.color, alpha: () => 1, steady: () => true }]
    : [];
};
