import { rect, span, type CameraStop, type Rect } from "svjeez";
import { rect as partRect } from "./find.ts";
import { timeline, type Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

/** What the camera frames at a snapshot: a part, or the whole snapshot. */
export type Shot = string | { readonly part: string; readonly index?: number; readonly zoom?: number };

const named = (shot: Shot): shot is string => typeof shot === "string";

export interface ShotsOptions {
  /** The camera's frame: where on the picture the shots are fitted. */
  readonly frame: Rect;
  /** Seconds each camera move takes. Default 0.5. A shot that comes sooner after the one before waits its turn. */
  readonly over?: number;
  /** Room kept around a part, in px of the snapshot. Default 16. */
  readonly margin?: number;
  /** The most a part is blown up, so a small one doesn't fill the frame. Default 2. */
  readonly zoom?: number;
}

/** Grows `r` about its center to at least `w` by `h`. */
const grow = (r: Rect, w: number, h: number): Rect => {
  const W = Math.max(r.w, w);
  const H = Math.max(r.h, h);

  return rect(r.x - (W - r.w) / 2, r.y - (H - r.h) / 2, W, H);
};

/** Slides `r` inside the snapshot where it fits, so the camera doesn't show past its edges. */
const inside = (r: Rect, s: Snapshot): Rect => {
  const slide = (at: number, size: number, room: number) => Math.min(Math.max(at, 0), room - size);

  return rect(
    r.w >= s.width ? r.x : slide(r.x, r.w, s.width),
    r.h >= s.height ? r.y : slide(r.y, r.h, s.height),
    r.w,
    r.h,
  );
};

/**
 * Props for svjeez's `<Camera>` (`frame`, `stops`, `over`), by snapshot name: when the timeline moves into a snapshot named in `plan`, the camera
 * moves with it to frame that part, as it lands in that snapshot. `"all"` frames the whole snapshot, which is also where
 * it opens unless the first snapshot is named. Snapshots not in `plan` keep the shot before them.
 *
 * ```tsx
 * <Camera {...shots(steps, { email: "email", failed: "alert", idle: "all" }, { frame: rect(0, 0, 400, 300) })}>
 *   <Dom states={steps} />
 * </Camera>
 * ```
 */
export const shots = (
  steps: readonly Step[],
  plan: Readonly<Record<string, Shot>>,
  { frame, margin = 16, zoom = 2, over = 0.5 }: ShotsOptions,
) => {
  const { snaps, moves, length } = timeline(steps);

  const target = (snap: Snapshot, shot: Shot): Rect => {
    if (shot === "all") return rect(0, 0, snap.width, snap.height);

    const { part, index = 0, zoom: most = zoom } = named(shot) ? { part: shot } : shot;
    const box = partRect(snap, part, index);

    if (!box) throw new Error(`shots(): no part "${part}" in the snapshot "${snap.name ?? "unnamed"}".`);

    const padded = rect(box.x, box.y, box.width, box.height).pad(margin);

    return inside(grow(padded, frame.w / most, frame.h / most), snap);
  };

  // The first snapshot opens at 0; each later one named in the plan cuts in as the timeline moves into it.
  const cuts: { at: number; target: Rect }[] = [];

  snaps.forEach((snap, i) => {
    const shot = snap.name === undefined ? undefined : plan[snap.name];

    if (i === 0) cuts.push({ at: 0, target: target(snap, shot ?? "all") });
    else if (shot !== undefined)
      cuts.push({ at: Math.max(moves[i - 1]!.at, cuts.at(-1)!.at + over), target: target(snap, shot) });
  });

  // Each shot holds until the next one starts, the last to the end of the steps.
  const stops = cuts.map(({ at, target }, i): CameraStop => ({
    show: span(at, Math.max((cuts[i + 1]?.at ?? Math.max(length, at + over)) - at, over)),
    target,
  }));

  return { frame, stops, over };
};
