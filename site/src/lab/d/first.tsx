import { outlineOf } from "./outline";
import { build } from "./scene";
import { FIRST, LOOP, PRESETS } from "./shapes";

/** The first shape at the count the page opens on, settled: nothing pops in and the sum does not morph. */
export default () => {
  const outline = outlineOf(PRESETS.find((p) => p.name === FIRST.preset)!.points());

  return build({
    outline,
    n: FIRST.n,
    before: { outline, n: FIRST.n },
    freshFrom: FIRST.n,
    loop: LOOP,
  });
};
