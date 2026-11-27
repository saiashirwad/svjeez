/**
 * Claude Pelican 1, the launch film: one pelican riding round a small world, a new medium each chapter. Each shot lives
 * in `shots/` and plays on its own clock; `Shot` crossfades them.
 */
import { Group, Series, durationOf, scene } from "svjeez";
import { FADE, H, Shot, W } from "./kit";
import { BLUEPRINT, Blueprint } from "./shots/blueprint";
import { KRAFT, Kraft } from "./shots/kraft";
import { LACE, Lace } from "./shots/lace";
import { OPEN, Open } from "./shots/open";
import { POTTERY, Pottery } from "./shots/pottery";
import { SUN, Sun } from "./shots/sun";
import { TITLE, Title } from "./shots/title";
import { WATERCOLOUR, Watercolour } from "./shots/watercolour";

const film = (
  <Series gap={-FADE}>
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
      <Lace />
    </Shot>
    <Shot length={WATERCOLOUR}>
      <Watercolour />
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
    desc: "One white pelican rides a small road bike around a round world, and every chapter changes the medium: a pencil line on ivory, a chalk cyanotype bridge, the burning limb of the sun, a black-figure frieze on a Greek vase, three friends screen-printed on kraft paper, a lace doily on black velvet, and a watercolour hill in the rain. It closes on the name Claude Pelican 1: one pelican, every style.",
    loop: false,
    still: duration - 1,
  },
  () => <Group>{film}</Group>,
);
