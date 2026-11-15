import { rect, span, type CameraStop, type Rect } from "svjeez";
import { boxes } from "./find.ts";
import { timeline, type Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

/** What the camera frames at a snapshot: a part, or the whole snapshot. */
export type Shot = string | { readonly part: string; readonly index?: number; readonly zoom?: number };

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

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Grows `r` about its center to at least `w` by `h`. */
const grow = (r: Region, w: number, h: number): Region => {
  const W = Math.max(r.w, w);
  const H = Math.max(r.h, h);

  return { x: r.x - (W - r.w) / 2, y: r.y - (H - r.h) / 2, w: W, h: H };
};

/** Slides `r` inside the snapshot where it fits, so the camera doesn't show past its edges. */
const inside = (r: Region, s: Snapshot): Region => {
  const slide = (at: number, size: number, room: number) => Math.min(Math.max(at, 0), room - size);

  return {
    ...r,
    x: r.w >= s.width ? r.x : slide(r.x, r.w, s.width),
    y: r.h >= s.height ? r.y : slide(r.y, r.h, s.height),
  };
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
): { frame: Rect; stops: CameraStop[]; over: number } => {
  const { snaps, moves, length } = timeline(steps);

  const target = (snap: Snapshot, shot: Shot): Region => {
    if (shot === "all") return { x: 0, y: 0, w: snap.width, h: snap.height };

    const { part, index = 0, zoom: most = zoom } = typeof shot === "string" ? { part: shot } : shot;
    const box = boxes(snap, part)[index]?.box;

    if (!box) throw new Error(`shots(): no part "${part}" in the snapshot "${snap.name ?? "unnamed"}".`);

    const padded = { x: box.x - margin, y: box.y - margin, w: box.width + 2 * margin, h: box.height + 2 * margin };

    return inside(grow(padded, frame.w / most, frame.h / most), snap);
  };

  const framed = (r: Region) => rect(r.x, r.y, r.w, r.h);
  const first = snaps[0]!;
  const opening = first.name !== undefined && plan[first.name] !== undefined ? plan[first.name]! : "all";
  const cuts: [number, Region][] = [[0, target(first, opening)]];

  snaps.slice(1).forEach((snap, i) => {
    const shot = snap.name === undefined ? undefined : plan[snap.name];

    if (shot !== undefined)
      cuts.push([Math.max(moves[i]!.at, cuts.at(-1)![0] + over), target(snap, shot)]);
  });

  // Each shot holds until the next one starts, the last to the end of the steps.
  const stops = cuts.map(([at, r], i): CameraStop => ({
    show: span(at, Math.max((cuts[i + 1]?.[0] ?? Math.max(length, at + over)) - at, over)),
    target: framed(r),
  }));

  return { frame, stops, over };
};
