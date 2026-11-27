import type { Diagnostic, LaneReport } from "./model/backend";
import type { Scene } from "./model/ir";
import { isScene } from "./model/is-scene";
import { svg } from "./svg/svg";
import { startTrace, stopTrace } from "./svg/traced";
import { validateSvg } from "./svg/validate";

/** What `svjeez svg --json` prints: the SVG, its warnings, every animated lane, and the scene's timing. */
export interface SvgBuild {
  readonly svg: string;
  readonly warnings: readonly string[];
  readonly lanes: readonly LaneReport[];
  readonly duration?: number;
  readonly loop?: boolean;
}

/**
 * Builds what `load` makes, a scene or an SVG string, into an SVG with its warnings and lanes. With `within`, a
 * directory, every lane says where in the files under it it was written. Tracing is global, so run one build at a
 * time.
 */
export const build = async (
  load: () => Promise<Scene | string>,
  within?: string,
): Promise<SvgBuild> => {
  const diagnosed: string[] = [];
  const lanes: LaneReport[] = [];

  startTrace({ within });

  try {
    const value = await load();

    const out = isScene(value)
      ? svg.emit(value, {
          onWarning: (warning: Diagnostic) => diagnosed.push(warning.message),
          onLane: (lane) => lanes.push(lane),
          sources: within !== undefined,
        })
      : value;

    return {
      svg: out,
      warnings: [...diagnosed, ...validateSvg(out).warnings],
      lanes,
      ...(isScene(value) && { duration: value.duration, loop: value.loop }),
    };
  } finally {
    stopTrace();
  }
};
