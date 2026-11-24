import { FontBook, charName } from "../author/runs";
import { boundsOfPoints, boxCorners } from "../model/geometry";
import type { Box, SceneNode, TextNode, Vec } from "../model/ir";
import type { Seconds } from "../model/time";
import { apply, inverse, times as mulMatrix, type Placed } from "./boxes";
import {
  VISIBLE,
  add,
  fading,
  isGone,
  label,
  list,
  shownBoxes,
  spoken,
  type Survey,
} from "./inspect-context";
import { flatAt } from "./inspect-visibility";
import {
  area,
  countAt,
  countOf,
  inCount,
  meet,
  movingAt,
  runsOf,
  schemesOf,
  sharedArea,
  textOf,
  seconds,
  units,
  type Entry,
} from "./survey";

export const wideLines = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || node.along || isGone(survey, entry)) continue;

    const widest = Math.max(
      0,
      ...node.lines.map((line) => {
        const ends = line.runs.map(
          (run) => run.at[0] + run.advances.reduce((sum, a) => sum + a, 0),
        );

        return ends.length === 0 ? 0 : Math.max(...ends) - node.box.x;
      }),
    );

    if (widest <= node.box.width + 0.5) continue;
    add(survey, {
      code: "text-overflow",
      severity: "warning",
      key: node.key,
      message: `${spoken(node)} has a line ${units(widest)} wide in a column ${units(node.box.width)} wide: a single character is wider than the width it wraps to.`,
      fix: "Give it a wider width to wrap to, or a smaller size.",
    });
  }
};

const ink = (box: Box): Box => ({ ...box, y: box.y + box.height / 4, height: box.height / 2 });

const travelling = (entry: Entry, t: Seconds): boolean =>
  [...entry.ancestors, entry.node].some(
    (node) =>
      movingAt(node.at, t) ||
      node.layers.some(
        (layer) =>
          movingAt(layer.offset, t) ||
          movingAt(layer.rotate, t) ||
          movingAt(layer.scale, t) ||
          movingAt(layer.skew, t),
      ),
  );

const clippedOut = (entry: Entry, frame: ReadonlyMap<string, Placed>, box: Box): boolean =>
  entry.ancestors.some((ancestor) => {
    if (ancestor.clip === undefined) return false;
    const clip = frame.get(ancestor.key);

    return clip !== undefined && sharedArea(box, clip.box) <= 0;
  });

export const overlap = (survey: Survey): void => {
  const texts = survey.entries.filter(
    (entry) =>
      (entry.node.kind === "text" || countOf(entry.node) !== undefined) &&
      !inCount(entry) &&
      !isGone(survey, entry) &&
      ![...entry.ancestors, entry.node].some((node) => node.mask !== undefined),
  );

  const pairs = new Map<
    string,
    { readonly a: Entry; readonly b: Entry; readonly times: Seconds[] }
  >();

  const covered = new Map<
    string,
    { readonly text: Entry; readonly cover: Entry; readonly times: Seconds[] }
  >();

  survey.frames.forEach(({ t, frame }) => {
    const up = texts.flatMap((entry) => {
      const at = frame.get(entry.node.key);

      return at &&
        at.opacity > VISIBLE &&
        !fading(entry, t) &&
        !travelling(entry, t) &&
        !clippedOut(entry, frame, at.box)
        ? [{ entry, box: ink(at.box), full: at.box }]
        : [];
    });

    for (let x = 0; x < up.length; x++)
      for (let y = x + 1; y < up.length; y++) {
        const [a, b] = [up[x]!, up[y]!];

        if (wordsAt(a.entry.node, t) === wordsAt(b.entry.node, t) || !meet(a.entry, b.entry))
          continue;
        const shared = sharedArea(a.box, b.box);

        if (shared <= 0.1 * Math.min(area(a.box), area(b.box))) continue;

        if (hiddenBetween(survey, frame, a.entry, b.entry, t)) continue;
        const key = `${a.entry.node.key}\u0000${b.entry.node.key}`;
        const known = pairs.get(key) ?? { a: a.entry, b: b.entry, times: [] };

        known.times.push(t);
        pairs.set(key, known);
      }

    // Warn when a later opaque fill covers visible text (e.g. an opaque Stack backdrop over a message).
    for (const item of up) {
      for (const other of survey.entries) {
        if (
          other.order <= item.entry.order ||
          other.node.kind !== "shape" ||
          isGone(survey, other) ||
          !meet(item.entry, other)
        )
          continue;
        const at = frame.get(other.node.key);

        if (!at || at.opacity <= 0.95 || fading(other, t) || travelling(other, t)) continue;

        if (flatAt(survey, other, at, t) === undefined) continue;
        const hit = sharedArea(item.box, at.box);

        if (hit <= 0.25 * area(item.box)) continue;

        // Intentional card/panel replacement: an opaque shape completely hides an earlier text
        // while a later text sits over the same spot on top of that shape.
        if (
          hit > 0.8 * area(item.box) &&
          up.some(
            (later) =>
              later.entry.order > other.order &&
              sharedArea(item.box, later.box) > 0.1 * Math.min(area(item.box), area(later.box)),
          )
        )
          continue;

        const key = `${item.entry.node.key}\u0000${other.node.key}`;
        const known = covered.get(key) ?? { text: item.entry, cover: other, times: [] };

        known.times.push(t);
        covered.set(key, known);
      }
    }
  });

  for (const { a, b, times } of pairs.values())
    add(survey, {
      code: "overlap",
      severity: "warning",
      key: a.node.key,
      message: `${spoken(a.node, 24)} and ${spoken(b.node, 24)} overlap while both are shown, at ${list(times)}.`,
      fix: "Move one, or hide one while the other shows.",
      times,
      related: [b.node.key],
    });

  for (const { text, cover, times } of covered.values())
    add(survey, {
      code: "overlap",
      severity: "warning",
      key: text.node.key,
      message: `${spoken(text.node, 24)} is covered by ${label(cover.node)} drawn after it, at ${list(times)}.`,
      fix: `Move one of them, hide the text before "${cover.node.key}" appears, or draw the text after it.`,
      times,
      related: [cover.node.key],
    });
};

const wordsAt = (node: SceneNode, t: Seconds): string => {
  const count = countOf(node);

  return count ? countAt(count, t) : node.kind === "text" ? textOf(node) : "";
};

const hiddenBetween = (
  survey: Survey,
  frame: ReadonlyMap<string, Placed>,
  a: Entry,
  b: Entry,
  t: Seconds,
): boolean => {
  const [lower, upper] = a.order < b.order ? [a, b] : [b, a];
  const box = frame.get(lower.node.key)?.box;

  if (!box) return false;

  return survey.entries.slice(lower.order + 1, upper.order).some((entry) => {
    const at = frame.get(entry.node.key);

    return (
      entry.node.kind === "shape" &&
      at !== undefined &&
      schemesOf(lower).every((scheme) => schemesOf(entry).includes(scheme)) &&
      at.opacity > 0.95 &&
      flatAt(survey, entry, at, t) !== undefined &&
      sharedArea(at.box, box) > 0.8 * area(box)
    );
  });
};

export const missingGlyphs = (survey: Survey): void => {
  const { fonts } = survey.scene;

  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || isGone(survey, entry)) continue;
    const missing = new Map<string, Set<string>>();

    for (const run of runsOf(node)) {
      const family = fonts[run.face.family];

      if (!family) continue;

      const face =
        family.faces.find((f) => f.weight === run.face.weight && f.italic === run.face.italic) ??
        family.face(run.face.weight, run.face.italic);

      for (const char of FontBook.missing(face, run.text)) {
        const name = `${run.face.family} ${run.face.weight}${run.face.italic ? " italic" : ""}`;
        missing.set(name, (missing.get(name) ?? new Set()).add(char));
      }
    }

    for (const [face, chars] of missing) {
      const shown = [...chars].map(charName);

      add(survey, {
        code: "missing-glyph",
        severity: "error",
        key: node.key,
        message: `${spoken(node)} uses ${shown.join(", ")}, which ${face} has no glyph for, so each target draws something different there.`,
        fix: "Load a face that has these characters, or write the text without them.",
      });
    }
  }
};

const CONTAINERS = { stack: "<Stack>", grid: "<Grid>" } as const;

const overlapOf = (a: Box, b: Box): Vec | undefined => {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  return across > 0.5 && down > 0.5 ? [across, down] : undefined;
};

const localBoxOf = (parent: Placed | undefined, child: Placed): Box => {
  const back = parent ? inverse(parent.matrix) : undefined;

  if (!back) return child.box;
  const rel = mulMatrix(back, child.matrix);

  return boundsOfPoints(boxCorners(child.frame).map((point) => apply(rel, point)));
};

const ownMoving = (node: SceneNode, t: Seconds): boolean =>
  movingAt(node.at, t) ||
  node.layers.some(
    (layer) => movingAt(layer.offset, t) || movingAt(layer.opacity, t) || movingAt(layer.scale, t),
  );

/**
 * A group's at and anchor match a point of its box as it is at 0s. When what is inside moves, the box's corner moves
 * with it and the group sits off the point it was given, which only holds at 0s.
 */
export const movingBox = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;

    if (
      node.kind !== "group" ||
      !node.authored?.pinned ||
      node.authored.layout ||
      node.authored.count ||
      isGone(survey, entry)
    )
      continue;
    const rest = node.box;
    let worst: { by: number; t: Seconds } | undefined;

    for (const { t, frame } of survey.frames) {
      const now = frame.get(node.key)?.frame;

      if (!now) continue;

      const by = Math.max(Math.abs(now.x - rest.x), Math.abs(now.y - rest.y));

      if (by > 1 && (!worst || by > worst.by)) worst = { by, t };
    }

    if (!worst) continue;

    add(survey, {
      code: "moving-box",
      severity: "warning",
      key: node.key,
      message: `${label(node)} is placed by at or anchor against its box as it is at 0s, but what is inside it moves, so the corner it was pinned by has moved ${units(worst.by)} by ${seconds(worst.t)}, and the group has drifted off the point it was given.`,
      fix: "Move the group with offset (where its children's [0, 0] go), or keep the moving parts in an inner group and place an outer group that holds still.",
      times: [worst.t],
    });
  }
};

export const layoutOverlap = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;
    const container = node.authored?.layout?.container;

    if (
      node.kind !== "group" ||
      container === undefined ||
      container === "align" ||
      container === "center"
    )
      continue;

    if (isGone(survey, entry)) continue;

    // Negative gap intentionally overlaps children along the stack axis.
    const gap = node.authored?.layout?.gap;

    if (gap !== undefined && (gap[0] < 0 || gap[1] < 0)) continue;

    const children = survey.entries
      .filter(
        (each) =>
          each.ancestors.at(-1) === node && !each.node.authored?.backdrop && !isGone(survey, each),
      )
      .map((child) => ({
        entry: child,
        shown: new Set(shownBoxes(survey, child).map(({ t }) => t)),
      }));

    children.forEach((a, i) => {
      for (const b of children.slice(i + 1)) {
        let most: Vec = [0, 0];
        const times: Seconds[] = [];

        for (const { t, frame } of survey.frames) {
          if (!a.shown.has(t) || !b.shown.has(t)) continue;

          if (ownMoving(a.entry.node, t) || ownMoving(b.entry.node, t)) continue;

          const [pa, pb, parent] = [
            frame.get(a.entry.node.key),
            frame.get(b.entry.node.key),
            frame.get(node.key),
          ];

          if (!pa || !pb) continue;

          if (clippedOut(a.entry, frame, pa.box) || clippedOut(b.entry, frame, pb.box)) continue;
          const by = overlapOf(localBoxOf(parent, pa), localBoxOf(parent, pb));

          if (!by) continue;
          times.push(t);

          if (by[0] * by[1] > most[0] * most[1]) most = by;
        }

        if (times.length === 0) continue;
        add(survey, {
          code: "layout-overlap",
          severity: "warning",
          key: a.entry.node.key,
          message: `${label(a.entry.node)} and ${label(b.entry.node)} overlap by up to ${units(most[0])} by ${units(most[1])} in the ${CONTAINERS[container]} "${node.key}", at ${list(times)}. It placed them apart; a motion, rotate or scale carried one over the other.`,
          fix: `Give the ${CONTAINERS[container]} a larger gap, or move, turn or grow the child less.`,
          times,
          related: [b.entry.node.key],
        });
      }
    });
  }
};

const lineText = (node: TextNode, index: number): string =>
  node.lines[index]?.runs.map((run) => run.text).join("") ?? "";

export const wordCuts = (survey: Survey): void => {
  for (const entry of survey.entries) {
    const { node } = entry;

    if (node.kind !== "text" || isGone(survey, entry)) continue;
    const wrap = node.authored?.wrap;

    if (!wrap || wrap.cuts.length === 0) continue;

    const words = wrap.cuts.map(
      (index) =>
        `"${lineText(node, index).split(/\s+/).at(-1)}|${lineText(node, index + 1).split(/\s+/)[0]}"`,
    );

    add(survey, {
      code: "word-cut",
      severity: "warning",
      key: node.key,
      message: `${spoken(node)} wraps to ${units(wrap.width)} wide, and a word wider than that is cut across lines where | marks: ${words.join(", ")}.`,
      fix: "Give it a wider width to wrap to, a smaller size, or a shorter word.",
    });
  }
};
