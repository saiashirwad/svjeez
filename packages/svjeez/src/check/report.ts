import type { LaneReport } from "../model/backend";
import type { Scene } from "../model/ir";
import type { Seconds } from "../model/time";
import { svg } from "../svg/svg";
import { problemsOf } from "./inspect";
import type { Problem } from "./inspect-context";

export interface CheckOptions {
  /** Extra moments to sample, in scene seconds. */
  readonly times?: readonly Seconds[];
}

export interface Check {
  /** Errors first, then warnings and info, in paint order. */
  readonly problems: Problem[];
  /** Every animated lane the SVG backend wrote. */
  readonly lanes: LaneReport[];
  readonly cost?: { readonly animations: number; readonly repaint: number };
}

/** The scene model read once, and the SVG it emits: the problems, the lanes, and the SVG itself. */
export const examine = (
  scene: Scene,
  times?: readonly Seconds[],
): Check & { readonly svg?: string } => {
  const problems = problemsOf(scene, times);
  const lanes: LaneReport[] = [];

  if (problems.some((problem) => problem.code === "unsupported")) return { problems, lanes };

  const emitted = svg.emit(scene, { sources: true, onLane: (lane) => lanes.push(lane) });

  return { problems, lanes, svg: emitted };
};

/** Check a scene without a browser: every problem with its source and fix, and every animated lane. */
export const check = (scene: Scene, options: CheckOptions = {}): Check => {
  const { problems, lanes } = examine(scene, options.times);

  return { problems, lanes };
};
