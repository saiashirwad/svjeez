import type { LaneReport } from "../model/backend";
import type { Scene } from "../model/ir";
import type { Seconds } from "../model/time";
import { costOf, type Cost } from "../svg/cost";
import { svg } from "../svg/svg";
import { embeddedFontsOf } from "../svg/validate";
import { surveyed } from "./inspect";
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
  readonly cost?: Cost;
}

/** The scene model read once, and the SVG it emits: the problems, the lanes, and the SVG itself. */
export const examine = (
  scene: Scene,
  times?: readonly Seconds[],
): Check & { readonly svg?: string } => {
  const { problems, filters } = surveyed(scene, times);
  const lanes: LaneReport[] = [];

  if (problems.some((problem) => problem.code === "unsupported")) return { problems, lanes };

  const emitted = svg.emit(scene, { sources: true, onLane: (lane) => lanes.push(lane) });

  const whole = embeddedFontsOf(emitted).flatMap(({ label, bytes, reason }): Problem[] =>
    reason === undefined
      ? []
      : [
          {
            code: "whole-font",
            severity: "info",
            key: "",
            message: `${label} embeds whole, ${Math.round(bytes / 1024)} KB, because ${reason}.`,
            fix: "Load a TTF with TrueType outlines, or pass subset: false to the font to say the size is fine.",
          },
        ],
  );

  return {
    problems: [...problems, ...whole],
    lanes,
    cost: { ...costOf(svg.emit(scene)), filters: Math.round(filters / 1e5) / 10 },
    svg: emitted,
  };
};

/** Check a scene without a browser: every problem with its source and fix, and every animated lane. */
export const check = (scene: Scene, options: CheckOptions = {}): Check => {
  const { problems, lanes, cost } = examine(scene, options.times);

  return { problems, lanes, ...(cost && { cost }) };
};
