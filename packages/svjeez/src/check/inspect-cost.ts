import { isLane } from "../model/lane";
import { reachOf } from "../model/reach";
import { add, isGone, label, type Survey } from "./inspect-context";
import { changesOf, seconds, units, valuesOf, type Stretch } from "./survey";

/** What a filter reads: its own parameters. Anything else that moves under it makes it run again. */
const PARAMETERS = /^(blur|adjust|displace|shadow|noise)\b/;

/** What of a filtered node itself is redrawn through its filter (placing, fading and scaling it are not). */
const OWN = new Set([
  "geometry",
  "fill",
  "stroke color",
  "stroke width",
  "trim",
  "text fill",
  "text opacity",
]);

const SHARE = 0.1;

/** An effect that is run again every frame: its parameters move, or what it filters does. */
export const movingFilter = (survey: Survey): void => {
  const { scene } = survey;
  const [width, height] = scene.size;

  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.effects.length === 0 || isGone(survey, entry)) continue;

    const reasons: { readonly why: string; readonly stretches: Stretch[] }[] = [];

    for (const { name, value } of valuesOf(node)) {
      if (!isLane(value) || !(PARAMETERS.test(name) || OWN.has(name))) continue;
      const stretches = changesOf(value, scene.duration);

      if (stretches.length > 0)
        reasons.push({
          why: PARAMETERS.test(name)
            ? `its ${name} changes`
            : `its ${name} changes under the effect`,
          stretches,
        });
    }

    for (const inner of survey.entries) {
      if (!inner.ancestors.includes(node)) continue;

      const stretches = valuesOf(inner.node).flatMap(({ value }) =>
        changesOf(value, scene.duration),
      );

      if (stretches.length > 0)
        reasons.push({ why: `${label(inner.node)} inside it moves`, stretches });
    }

    const first = reasons[0];

    if (!first) continue;
    const all = reasons.flatMap(({ stretches }) => stretches);
    const [from, to] = [Math.min(...all.map(([a]) => a)), Math.max(...all.map(([, b]) => b))];
    const reach = reachOf(node, "inspect");

    if (!reach) continue;
    const share = (reach.width * reach.height) / (width * height);
    const kinds = [...new Set(node.effects.map((effect) => effect.kind))].join(" and ");

    add(survey, {
      code: "moving-filter",
      severity: share >= SHARE ? "warning" : "info",
      key: node.key,
      message: `${label(node)} has a ${kinds} that is redrawn every frame from ${seconds(from)} to ${seconds(to)} over ${units(reach.width)}×${units(reach.height)} units (${Math.round(share * 100)}% of the canvas): ${first.why}.`,
      fix: "Keep the effect still and move, fade or scale the node itself (or crossfade a sharp and a blurred copy), or make the filtered node smaller.",
      times: [from, to],
    });
  }
};
