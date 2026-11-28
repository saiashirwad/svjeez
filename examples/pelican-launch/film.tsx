/**
 * Claude Pelican 1, the launch film: one pelican riding round a small world, a new medium each chapter. Each shot lives
 * in `shots/` and plays on its own clock; `Shot` crossfades them, and the shots' keyed `horizon` arcs morph across each
 * seam (`share`), so the world bends from one chapter's shape into the next while the pelican rides on.
 */
import { Group, Series, durationOf, ease, exit, scene, span } from "svjeez";
import { Odometer } from "./hud";
import { FADE, H, Shot, W } from "./kit";
import { BLUEPRINT, Blueprint } from "./shots/blueprint";
import { GLOBE, Globe } from "./shots/globe";
import { KRAFT, Kraft } from "./shots/kraft";
import { LACE, Lace } from "./shots/lace";
import { OPEN, Open } from "./shots/open";
import { POTTERY, Pottery } from "./shots/pottery";
import { SOURCE, Source } from "./shots/source";
import { SUN, Sun } from "./shots/sun";
import { THEORY, Theory } from "./shots/theory";
import { TITLE, Title } from "./shots/title";
import { WATERCOLOUR, Watercolour } from "./shots/watercolour";

const film = (
  <Series gap={-FADE} share={{ keys: "horizon", curve: ease.inOut }}>
    <Shot length={OPEN} first>
      <Open />
    </Shot>
    <Shot length={BLUEPRINT}>
      <Blueprint />
    </Shot>
    <Shot length={SUN}>
      <Sun />
    </Shot>
    <Shot length={POTTERY}>
      <Pottery />
    </Shot>
    <Shot length={KRAFT}>
      <Kraft />
    </Shot>
    <Shot length={LACE}>
      {/* Lace fades out before Watercolour fades in: fading the rainy painting in over the textured doily rastered every doily filter again each frame (41 fps in svjeez perf). */}
      <Group motion={exit(span(LACE - 2 * FADE, FADE), { curve: ease.inOut })}>
        <Lace />
      </Group>
    </Shot>
    <Shot length={WATERCOLOUR}>
      <Watercolour />
    </Shot>
    <Shot length={SOURCE}>
      <Source />
    </Shot>
    <Shot length={THEORY}>
      <Theory />
    </Shot>
    <Shot length={GLOBE}>
      <Globe />
    </Shot>
    <Shot length={TITLE} last>
      <Title />
    </Shot>
  </Series>
);

const duration = durationOf(film);

export default scene(
  {
    size: [W, H],
    duration,
    title: "Claude Pelican 1",
    desc: "One white pelican rides a small road bike around a round world, and every chapter changes the medium: a pencil line on ivory, a chalk cyanotype bridge, the burning limb of the sun, a black-figure frieze on a Greek vase, three friends screen-printed on kraft paper, a lace doily on black velvet, a watercolour hill in the rain, the pelican's own source code changing its colours, the geometry of its pedalling leg, and its route traced across a turning globe. The horizon bends from one chapter's world into the next, and a small odometer counts the kilometres. It closes on the name Claude Pelican 1: one pelican, every style.",
    loop: false,
    still: duration - 1,
  },
  () => (
    <Group>
      {film}
      <Odometer length={duration} />
    </Group>
  ),
);
