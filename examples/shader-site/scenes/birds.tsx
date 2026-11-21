import { Group, Sequence, Shape, ease, line, span, track, type Clock, type Vec } from "svjeez";
import { shifting } from "./palette";

const WINGS = line([-13, -5], [-6, -1], [0, 2], [6, -1], [13, -5]);
const CROSSING = 44;

/** One bird in the flock: `place` from the flock's lead, its size, and how long a wingbeat takes. */
const Bird = ({
  place,
  size,
  beat,
  hour,
}: {
  place: Vec;
  size: number;
  beat: number;
  hour: Clock;
}) => (
  <Group
    at={track<Vec>(place)
      .to([place[0], place[1] - 6 * size], span(0, beat * 3), ease.inOut)
      .to(place, span(beat * 3, beat * 3), ease.inOut)
      .loop(beat * 6)}
  >
    <Sequence clock={hour}>
      <Shape
        geometry={WINGS}
        stroke={{
          color: shifting("deep", hour.over),
          width: 2.2,
          cap: "round",
          join: "round",
          fixedWidth: true,
        }}
        scale={track<Vec>([size, size])
          .to([size, -size * 0.55], span(0, beat / 2), ease.inOut)
          .to([size, size], span(beat / 2, beat / 2), ease.inOut)
          .loop(beat)}
      />
    </Sequence>
  </Group>
);

/** A small flock that drifts across the sky, near birds larger than far ones, each with its own wingbeat. */
export const Flock = ({ hour, width, height }: { hour: Clock; width: number; height: number }) => (
  <Group
    at={track<Vec>([-260, height])
      .to([width + 160, height - 60], span(0, CROSSING), ease.linear)
      .loop(CROSSING)}
  >
    <Bird hour={hour} place={[0, 0]} size={1.1} beat={0.9} />
    <Bird hour={hour} place={[-46, 22]} size={0.9} beat={0.82} />
    <Bird hour={hour} place={[-90, -14]} size={0.8} beat={0.95} />
    <Bird hour={hour} place={[-128, 36]} size={0.7} beat={0.78} />
    <Bird hour={hour} place={[-170, 8]} size={0.6} beat={0.88} />
    <Bird hour={hour} place={[-205, 48]} size={0.5} beat={0.74} />
  </Group>
);
