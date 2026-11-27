/**
 * A shared-element transition: two shots in a `<Series share="horizon">`. The horizon morphs from a small flat arc
 * into a big curved one over the shots' 1.2 s overlap, while the backgrounds crossfade and the circle stays put.
 */
import {
  Group,
  Sequence,
  Series,
  Shape,
  circle,
  ease,
  enter,
  exit,
  rect,
  scene,
  span,
  type Paint,
} from "svjeez";
import { H, W, clay, horizon, ivory, oat, slate } from "./kit";

const FADE = 1.2;
const LENGTH = 2;

const shot = (fill: Paint, line: Paint, top: number, radius: number, sweep: number, i: number) => {
  const world = horizon(top, radius);

  return (
    <Sequence when={span(0, LENGTH)}>
      <Group
        motion={[
          i > 0 && enter(span(0, FADE), { curve: ease.inOut }),
          i === 0 && exit(span(LENGTH - FADE, FADE), { curve: ease.inOut }),
        ]}
      >
        <Shape geometry={rect(W, H)} fill={fill} />
        <Shape
          key="horizon"
          geometry={world.visible(sweep)}
          offset={world.center}
          stroke={{ color: line, width: i === 0 ? 4 : 10, cap: "round" }}
        />
      </Group>
    </Sequence>
  );
};

export default scene(
  {
    size: [W, H],
    duration: 2 * LENGTH - FADE,
    title: "Shared horizon",
    desc: "A flat clay arc low on ivory bends into a tall dark arc on oat while a circle holds still.",
    loop: false,
    still: 2 * LENGTH - FADE,
  },
  () => (
    <Group>
      <Series gap={-FADE} share="horizon">
        {shot(ivory, clay, 560, 2400, 24, 0)}
        {shot(oat, slate, 240, 420, 150, 1)}
      </Series>
      <Shape geometry={circle(36)} at={[W / 2, 200]} fill={slate} />
    </Group>
  ),
);
