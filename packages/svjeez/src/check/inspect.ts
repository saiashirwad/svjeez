import { FEATURES, diagnose } from "../model/backend";
import type { Scene } from "../model/ir";
import type { Seconds } from "../model/time";
import { add, type Problem, type Related, type Severity, type Survey } from "./inspect-context";
import { lowContrast } from "./inspect-contrast";
import {
  layoutOverlap,
  missingGlyphs,
  movingBox,
  overlap,
  wideLines,
  wordCuts,
} from "./inspect-layout";
import { movingFilter } from "./inspect-cost";
import { loopSeam, timing } from "./inspect-timing";
import { svg } from "../svg/svg";
import { neverVisible, offCanvas } from "./inspect-visibility";
import { entriesOf, framesOf, hiddenOf, momentsOf, namesOf, sourcesOf } from "./survey";

const capabilities = (survey: Survey): void => {
  const backend = svg;

  for (const found of diagnose(survey.scene, backend))
    add(survey, {
      code: found.severity === "error" ? "unsupported" : "approximate",
      severity: found.severity,
      key: found.key,
      message: found.message,
      fix:
        found.severity === "error"
          ? `Draw it without ${FEATURES[found.feature]} for ${backend.name}, or emit for a backend that has it.`
          : `Keep it if the difference is fine for ${backend.name}, or draw it without ${FEATURES[found.feature]}.`,
    });
};

const folded = (findings: readonly Problem[], names: ReadonlyMap<string, string>): Problem[] => {
  const out: Problem[] = [];
  const at = new Map<string, { index: number; more: string[]; times: Set<Seconds> }>();

  for (const finding of findings) {
    const { source, key } = finding;

    if (!source || key === "") {
      out.push(finding);
      continue;
    }

    const id = [
      finding.code,
      finding.severity,
      source.file,
      source.line,
      source.column,
      finding.message.replaceAll(names.get(key) ?? `"${key}"`, ""),
    ].join("\u0000");

    const known = at.get(id);

    if (known) {
      known.more.push(key);

      for (const t of finding.times ?? []) known.times.add(t);
    } else {
      at.set(id, { index: out.length, more: [], times: new Set(finding.times) });
      out.push(finding);
    }
  }

  for (const { index, more, times } of at.values()) {
    if (more.length === 0) continue;
    const first = out[index]!;

    out[index] = {
      ...first,
      message: first.message.replace(
        names.get(first.key) ?? `"${first.key}"`,
        (name) => `${name} (and ${more.length} more written at the same place)`,
      ),
      related: [
        ...(first.related ?? []),
        ...more.map((key): Related => ({ key, source: first.source! })),
      ],
      ...(times.size > 0 && { times: [...times].sort((a, b) => a - b) }),
    };
  }

  return out;
};

const RANK: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 };

/** Every problem the model shows, as the SVG backend would draw it: errors first, then paint order. */
export const problemsOf = (scene: Scene, sampled?: readonly Seconds[]): Problem[] => {
  const entries = entriesOf(scene);
  const times = momentsOf(scene, sampled);
  const out: Problem[] = [];

  const survey = {
    scene,
    entries,
    sources: sourcesOf(scene),
    frames: framesOf(scene, times),
    hidden: new Map(entries.map((entry) => [entry.node.key, hiddenOf(entry, scene.duration)])),
    gone: new Set<string>(),
    out,
  } satisfies Survey;

  neverVisible(survey);
  offCanvas(survey);
  wideLines(survey);
  missingGlyphs(survey);
  overlap(survey);
  lowContrast(survey);
  loopSeam(survey);
  timing(survey);
  movingFilter(survey);
  movingBox(survey);
  layoutOverlap(survey);
  wordCuts(survey);
  capabilities(survey);

  const order = new Map(entries.map((entry) => [entry.node.key, entry.order]));

  return folded(out, namesOf(scene))
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        RANK[a.finding.severity] - RANK[b.finding.severity] ||
        (order.get(a.finding.key) ?? Infinity) - (order.get(b.finding.key) ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ finding }) => finding);
};
