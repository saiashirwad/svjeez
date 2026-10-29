// The timeline, read back from the compiled file's CSS through the browser's own CSS parser, so it is the file's clock.
import { callsIn, type Source } from "@svjeez/live/source";

export interface Bar {
  readonly from: number;
  readonly to: number;
  readonly ease: readonly number[] | null;
  /** Where the `.to(…)` that made this step is in the source, and its line. */
  readonly at: number;
  readonly line: number;
}

export interface Row {
  readonly cls: string;
  readonly keys: readonly string[];
  readonly label: string;
  readonly bars: readonly Bar[];
}

export interface Timeline {
  readonly duration: number;
  readonly rows: readonly Row[];
}

/** CSSOM gives timing functions only as text, so the control points are read out of `cubic-bezier(…)`. */
const easeOf = (timing: string): number[] | null => {
  if (timing === "linear") return [0, 0, 1, 1];
  const inside = /^cubic-bezier\((.*)\)$/.exec(timing)?.[1];

  return inside ? inside.split(",").map(Number) : null;
};

const elementAt = (scene: Source, key: string) =>
  scene.elements.find((e) => e.builtin && e.key === key);

/** Where each `.to(…)` in the element's animation is, and its line, in the order they run. */
const stepsOf = (scene: Source, key: string) => {
  const el = elementAt(scene, key);

  return el ? callsIn(scene, el, "to").map(([at]) => ({ at, line: scene.lineAt(at) })) : [];
};

/** A row's name: the motion's `.label(…)`, else the name the element's fill reads, else its tag. */
const nameOf = (scene: Source, key: string): string => {
  const el = elementAt(scene, key);

  if (!el) return "?";
  const [label] = callsIn(scene, el, "label");

  const text =
    label &&
    scene.literals.find(
      (l) => l.kind === "string" && l.range[0] >= label[0] && l.range[1] <= label[1],
    );

  if (text) return String(text.value);

  return el.attributes.find((a) => a.name === "fill")?.ref ?? el.tag;
};

const seconds = (value: string) => (value ? parseFloat(value) : NaN);

/** A keyframe's values, without its timing function, so two keyframes compare by what they show. */
const valueOf = (style: CSSStyleDeclaration) =>
  [...style]
    .flatMap((p) =>
      p === "animation-timing-function" ? [] : [`${p}:${style.getPropertyValue(p)}`],
    )
    .join(";");

interface Stop {
  readonly at: number;
  readonly value: string;
  readonly ease: string;
}

/**
 * One row per animated class in `svg`, a file compiled with `render({ sources: true })` from `scene`, so each element
 * says which line of the scene made it.
 */
export const readTimeline = (svg: string, scene: Source): Timeline => {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(doc.querySelector("style")?.textContent ?? "");
  const frames = new Map<string, Stop[]>();
  const classes: CSSStyleRule[] = [];
  let shared: CSSStyleDeclaration | undefined;

  for (const rule of sheet.cssRules)
    if (rule instanceof CSSKeyframesRule) {
      const stops = [...rule.cssRules]
        .filter((k) => k instanceof CSSKeyframeRule)
        .flatMap((k) =>
          k.keyText.split(",").map((at) => ({
            at: parseFloat(at) / 100,
            value: valueOf(k.style),
            ease: k.style.animationTimingFunction,
          })),
        );

      frames.set(
        rule.name,
        stops.sort((a, b) => a.at - b.at),
      );
    } else if (rule instanceof CSSStyleRule) {
      if (rule.selectorText === ".a") shared = rule.style;
      else if (rule.style.animationName) classes.push(rule);
    }

  const duration = seconds(shared?.animationDuration ?? "") || 0;
  const rows: Row[] = [];

  for (const rule of classes) {
    const cls = rule.selectorText.slice(1);
    const stops = frames.get(rule.style.animationName) ?? [];
    const period = seconds(rule.style.animationDuration) || duration;

    const base = easeOf(
      rule.style.animationTimingFunction || shared?.animationTimingFunction || "",
    );

    const keys = [
      ...new Set(
        [...doc.getElementsByClassName(cls)].map((e) => e.getAttribute("data-source") ?? ""),
      ),
    ];

    const key = keys[0] ?? "";
    const made = stepsOf(scene, key);
    const steps: Omit<Bar, "from" | "to">[] = [];
    const spans: [number, number][] = [];

    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i]!;
      const b = stops[i + 1]!;

      if (a.value === b.value || b.at <= a.at) continue;
      spans.push([a.at * period, b.at * period]);
      steps.push({ ease: easeOf(a.ease) ?? base, ...(made[steps.length] ?? { at: -1, line: 0 }) });
    }

    const bars: Bar[] = [];

    for (let lap = 0; lap * period < duration - 1e-6; lap++)
      spans.forEach(([from, to], i) =>
        bars.push({ from: from + lap * period, to: to + lap * period, ...steps[i]! }),
      );
    rows.push({ cls, keys, label: nameOf(scene, key), bars });
  }

  // Copies a map() made run on classes of their own, so rows that share an element are numbered.
  return {
    duration,
    rows: rows.map((r) => {
      const twins = rows.filter((o) => o.keys[0] === r.keys[0]);

      return twins.length > 1 ? { ...r, label: `${r.label} ${twins.indexOf(r) + 1}` } : r;
    }),
  };
};
