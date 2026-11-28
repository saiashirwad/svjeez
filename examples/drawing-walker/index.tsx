/** A four-legged robot trots in place on a scrolling floor: every leg, antenna and the tail is a <Limb>. */
import {
  Group,
  Limb,
  Shape,
  blob,
  brush,
  circle,
  ease,
  rect,
  sampled,
  scatter,
  scene,
  span,
  track,
  type Color,
  type Vec,
} from "svjeez";

const WALK = 1;
const DURATION = 2;
const GROUND = 340;
const HIP_Y = 220;
const STRIDE = 40;
const LIFT = 26;
const BOB = 4;
const WHOLE = span(0, DURATION);

/** Hip height above the stance foot, in the body's frame. */
const DROP = GROUND - HIP_Y;

/** The body rises mid-stance: two bobs per walk cycle, highest at a quarter turn. */
const bob = (t: number): number => BOB * Math.cos((4 * Math.PI * t) / WALK);

/** Foot offset from its hip at time t: slides back along the floor for half a cycle, then lifts and swings. */
const footPath = (t: number, phase: number): Vec => {
  const u = (((t / WALK + phase) % 1) + 1) % 1;

  if (u < 0.5) return [STRIDE - 4 * STRIDE * u, 0];
  const s = (u - 0.5) * 2;

  return [-STRIDE + STRIDE * (1 - Math.cos(Math.PI * s)), -LIFT * Math.sin(Math.PI * s)];
};

interface LegProps {
  readonly hip: number;
  readonly phase: number;
  readonly bend: 1 | -1;
  readonly color: Color;
  readonly joint: Color;
}

/** The hip rides the body's bob as a moving root; the foot target is a plain floor position in the same frame. */
const Leg = ({ hip, phase, bend, color, joint }: LegProps) => (
  <Limb
    root={(t) => [hip, bob(t)]}
    bones={[70, 70]}
    bend={bend}
    over={WHOLE}
    step={DURATION / 80}
    reach={(t) => {
      const [x, y] = footPath(t, phase);

      return [hip + x, DROP + y];
    }}
    bone={(length, index) => (
      <Shape
        geometry={brush(
          [
            [0, 0],
            [length, 0],
          ],
          index === 0 ? [20, 13] : [13, 9],
        )}
        fill={color}
      />
    )}
    joint={(index) => (
      <Shape geometry={circle(index === 2 ? 8 : 8.5)} fill={index === 2 ? "#F2C14E" : joint} />
    )}
  />
);

/** An antenna that waves on its own beat, rooted on the head. */
const Antenna = ({ root, phase }: { root: Vec; phase: number }) => (
  <Limb
    root={root}
    bones={[22, 20]}
    bend={-1}
    over={WHOLE}
    step={DURATION / 40}
    reach={(t) => {
      const a = (2 * Math.PI * t) / DURATION + phase;

      return [root[0] + 14 + 10 * Math.sin(a), root[1] - 40 + 5 * Math.cos(2 * a)];
    }}
    bone={(length) => (
      <Shape
        geometry={brush(
          [
            [0, 0],
            [length, 0],
          ],
          [5, 3],
        )}
        fill="#E07A5F"
      />
    )}
    joint={(index) => index === 2 && <Shape geometry={circle(4.5)} fill="#F2C14E" />}
  />
);

const TAIL: Vec = [-86, -14];

const BODY = blob(
  [
    [-92, -34],
    [-20, -52],
    [70, -46],
    [98, -14],
    [60, 30],
    [-30, 36],
    [-88, 22],
  ],
  { round: 0.55 },
);

const HEAD = blob(
  [
    [96, -64],
    [124, -76],
    [152, -54],
    [150, -28],
    [112, -24],
  ],
  { round: 0.5 },
);

const DASH = rect(26, 5, { radius: 2.5 });

const PEBBLE = blob([
  [0, 0],
  [8, -7],
  [20, -2],
  [13, 6],
]);

const rail = (y: number) =>
  brush(
    [
      [0, y],
      [960, y],
    ],
    1,
  );

/**
 * The floor slides left at the foot's stance speed, one `period` of pattern at a time, snapping back to the start of
 * the pattern between sweeps. It begins `head` px into a sweep so the last sweep ends where the first began.
 */
const scroll = (period: number, head: number) => {
  const speed = (4 * STRIDE) / WALK;
  let out = track<Vec>([-head, 0]);
  let at = 0;
  let from = head;

  while (at < DURATION - 1e-9) {
    const reach = Math.min(period, from + speed * (DURATION - at));
    const over = (reach - from) / speed;

    out = out.to([-reach, 0], span(at, over), ease.linear);
    at += over;
    from = 0;

    if (at < DURATION - 1e-9) out = out.set([0, 0], span(at));
  }

  return out;
};

export default scene(
  { size: [640, 400], duration: DURATION, title: "Four-legged robot walking in place" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#1F2A44" />
      <Shape geometry={circle(46)} offset={[500, 90]} fill="#F7E8C4" />
      <Shape geometry={rect(640, 70)} at={[0, GROUND]} fill="#2B3A5C" />
      <Shape geometry={rail(GROUND)} fill="#4A5F8C" offset={[0, 0]} />
      <Shape
        geometry={scatter(DASH, {
          along: rail(GROUND + 22),
          count: 12,
        })}
        fill="#4A5F8C"
        offset={scroll(80, 40)}
      />
      <Shape
        geometry={scatter(PEBBLE, { along: rail(GROUND + 48), count: 6, alternate: true })}
        fill="#5C7099"
        offset={scroll(160, 80)}
      />

      <Group offset={[320, HIP_Y]}>
        <Leg hip={66} phase={0.5} bend={-1} color="#3B4F7A" joint="#2A3A5C" />
        <Leg hip={-48} phase={0} bend={1} color="#3B4F7A" joint="#2A3A5C" />
        <Group
          offset={sampled((t): Vec => [0, bob(t)], WHOLE, { tolerance: 0.05, step: DURATION / 80 })}
        >
          <Limb
            root={TAIL}
            bones={[24, 22]}
            bend={1}
            over={WHOLE}
            step={DURATION / 40}
            reach={(t) => [TAIL[0] - 36, TAIL[1] - 6 + 14 * Math.sin((4 * Math.PI * t) / WALK + 1)]}
            bone={(length) => (
              <Shape
                geometry={brush(
                  [
                    [0, 0],
                    [length, 0],
                  ],
                  [9, 5],
                )}
                fill="#3D5A80"
              />
            )}
          />
          <Shape geometry={BODY} fill="#5B7DB1" />
          <Shape geometry={rect(70, 10, { radius: 5 })} at={[-30, -8]} fill="#3D5A80" />
          <Shape
            geometry={brush(
              [
                [88, -30],
                [104, -50],
              ],
              [18, 14],
            )}
            fill="#3D5A80"
          />
          <Shape geometry={HEAD} fill="#7BA0D6" />
          <Shape geometry={circle(8)} offset={[130, -50]} fill="#F7E8C4" />
          <Shape geometry={circle(4)} offset={[132, -50]} fill="#1F2A44" />
          <Antenna root={[110, -74]} phase={0} />
          <Antenna root={[126, -76]} phase={Math.PI} />
        </Group>
        <Leg hip={50} phase={0} bend={-1} color="#4F6FA5" joint="#2F4570" />
        <Leg hip={-64} phase={0.5} bend={1} color="#4F6FA5" joint="#2F4570" />
      </Group>
    </Group>
  ),
);
