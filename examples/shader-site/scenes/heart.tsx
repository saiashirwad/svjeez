import { Group, Sequence, Shape, clock, ease, looping, path, scene, span, track } from "svjeez";

const HEART = path.parse(
  "M11 19.5C11 19.5 0 12.7 0 6.1C0 2.7 2.6 0 5.9 0C8.1 0 9.9 1.3 11 3.1C12.1 1.3 13.9 0 16.1 0C19.4 0 22 2.7 22 6.1C22 12.7 11 19.5 11 19.5Z",
);

/** The page loops this clock while either logo is hovered or focused: a stronger, quicker beat. */
const pump = clock("pump", span(1.4, 0.7));

/** A double beat over `over` seconds, up to `strength` and back. */
const beat = (strength: number, over: number) =>
  track(1)
    .to(1 + strength, span(0, over * 0.12), ease.out)
    .to(1, span(over * 0.12, over * 0.14), ease.inOut)
    .to(1 + strength * 0.6, span(over * 0.26, over * 0.1), ease.out)
    .to(1, span(over * 0.36, over * 0.24), ease.inOut);

export default scene(
  {
    size: [22, 19.5],
    duration: 2.4,
    title: "Heart",
    desc: "A small heart that beats gently, and quicker when a logo beside it is hovered.",
    still: 0,
    states: { idle: { pump: 0 }, pump: { pump: looping } },
  },
  () => (
    <Group origin="center" scale={beat(0.06, 1.2).loop(2.4)}>
      <Sequence clock={pump}>
        <Shape geometry={HEART} origin="center" fill="#FF8FA3" scale={beat(0.22, 0.7)} />
      </Sequence>
    </Group>
  ),
);
