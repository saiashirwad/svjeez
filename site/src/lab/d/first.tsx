import { outlineOf } from "./outline";
import { build } from "./scene";
import { FIRST, LOOP, PRESETS } from "./shapes";

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
