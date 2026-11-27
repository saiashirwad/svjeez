/** A three-bone desk lamp keeps its head and light cone on a bouncing ball, drawn with <Limb>, brush and blob. */
import {
  Group,
  Limb,
  Shape,
  blob,
  brush,
  circle,
  limb,
  line,
  polygon,
  rect,
  sampled,
  scene,
  span,
  type Vec,
} from "svjeez";

const PERIOD = 6;
const FLOOR = 336;
const RADIUS = 14;
const ROOT: Vec = [110, 312];
const BONES = [125, 110, 85];
const DEG = 180 / Math.PI;

/** The ball at time t: rolls back and forth while it bounces three times per loop. */
const ballAt = (t: number): Vec => {
  const hop = ((3 * t) / PERIOD) % 1;

  return [
    440 + 110 * Math.sin((2 * Math.PI * t) / PERIOD),
    FLOOR - RADIUS - 110 * 4 * hop * (1 - hop),
  ];
};

/** Where the lamp tip hovers: above the ball, but moving only a share as far, so the arm stays calm. */
const tipAt = (t: number): Vec => {
  const [x, y] = ballAt(t);

  return [300 + (x - 440) * 0.35, 100 + (y - 300) * 0.25];
};

/** Degrees of the head in the last bone's frame so that it faces the ball. */
const headTurn = (t: number): number => {
  const joints = limb(ROOT, BONES, tipAt(t), { bend: 1 });
  const [a, b] = [joints.at(-2)!, joints.at(-1)!];
  const arm = Math.atan2(b[1] - a[1], b[0] - a[0]) * DEG;
  const [x, y] = ballAt(t);
  const aim = Math.atan2(y - b[1], x - b[0]) * DEG;

  return ((((aim - arm) % 360) + 540) % 360) - 180;
};

const beam = (t: number): number => {
  const [x, y] = ballAt(t);
  const [tx, ty] = tipAt(t);

  return Math.hypot(x - tx, y - ty);
};

const zigzag = (from: number, to: number, y: number): Vec[] =>
  Array.from({ length: 11 }, (_, i): Vec => [
    from + ((to - from) * i) / 10,
    y + (i === 0 || i === 10 ? 0 : i % 2 ? -5 : 5),
  ]);

const STEEL = "#3F4A5A";
const STEEL_LIGHT = "#6B7A8F";
const SAMPLING = { tolerance: 0.2, step: PERIOD / 96 };

export default scene(
  { size: [640, 400], duration: PERIOD, title: "Desk lamp tracking a bouncing ball" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#1F2733" />
      <Shape geometry={rect(640, 64)} at={[0, FLOOR]} fill="#8A5A3B" />
      <Shape geometry={rect(640, 6)} at={[0, FLOOR]} fill="#A9744F" />
      <Shape
        geometry={blob(
          [
            [60, FLOOR],
            [78, 316],
            [142, 316],
            [160, FLOOR],
          ],
          { round: 0.2 },
        )}
        fill="#2B3240"
      />
      <Shape geometry={rect(100, 8, { radius: 4 })} at={[60, 322]} fill={STEEL} />
      <Limb
        root={ROOT}
        bones={BONES}
        reach={tipAt}
        over={span(0, PERIOD)}
        bend={1}
        tolerance={0.2}
        step={PERIOD / 96}
        bone={(length, index) => (
          <Group>
            <Shape
              geometry={brush(
                [
                  [0, 0],
                  [length, 0],
                ],
                index === 2 ? [7, 6] : [9, 7],
              )}
              fill={STEEL}
            />
            {index < 2 && (
              <Shape
                geometry={line(...zigzag(18, length - 18, -9))}
                fill={undefined}
                stroke={{ color: STEEL_LIGHT, width: 1.5, join: "round" }}
              />
            )}
          </Group>
        )}
        joint={(index) =>
          index < 3 ? (
            <Group>
              <Shape geometry={circle(index === 0 ? 11 : 8)} fill="#2B3240" />
              <Shape geometry={circle(3.5)} fill="#E8B04B" />
            </Group>
          ) : (
            <Group rotate={sampled(headTurn, span(0, PERIOD), SAMPLING)} origin={{ frame: [0, 0] }}>
              <Shape
                geometry={sampled(
                  (t) => {
                    const far = beam(t) - 22;

                    return polygon([16, -7], [far, -22], [far, 22], [16, 7]);
                  },
                  span(0, PERIOD),
                  SAMPLING,
                )}
                fill="#FFE9A640"
              />
              <Shape
                geometry={blob(
                  [
                    [-12, -9],
                    [18, -20],
                    [30, 0],
                    [18, 20],
                    [-12, 9],
                  ],
                  { round: 0.4 },
                )}
                fill="#2B3240"
              />
              <Shape geometry={circle(6)} fill="#FFF1C2" offset={[27, 0]} />
              <Shape geometry={circle(4)} fill="#E8B04B" />
            </Group>
          )
        }
      />
      <Shape
        geometry={circle(RADIUS)}
        offset={sampled(ballAt, span(0, PERIOD), { tolerance: 0.2, step: PERIOD / 96 })}
        fill="#E5584B"
      />
    </Group>
  ),
);
