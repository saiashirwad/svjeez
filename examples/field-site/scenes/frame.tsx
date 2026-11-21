import { Arrow, Group, Shape, Text, moved, path, rect, type Anim, type Vec } from "svjeez";
import { HEIGHT, STEP, UNIT, WIDTH, equipotential } from "./field";
import { ACCENT, COOL, INK, MUTED, TEXT, WARM, mono } from "./style";

/** A small tag on a leader, shown while peeled. */
export const Plate = ({
  tag,
  at,
  point,
  opacity,
}: {
  tag: string;
  at: Vec;
  point: Vec;
  opacity: Anim<number>;
}) => (
  <Group opacity={opacity}>
    <Arrow from={at} to={point} head={5} inset={4} stroke={{ color: ACCENT, width: 1 }} />
    <Text font={mono} size={13} fill={ACCENT} at={at} anchor={[0, 0]}>
      {tag}
    </Text>
  </Group>
);

/** The engineering frame: a hairline border, rulers along the top and left in u, and a scale bar. */
export const Rulers = () => {
  const marks = (length: number, every: number) =>
    Array.from(
      { length: Math.floor((length - 40) / every) },
      (_, index) => 20 + every * (index + 1),
    ).filter((at) => at < length - 20);

  const ticks = (length: number, every: number, long: number, across: boolean) =>
    marks(length, every).reduce(
      (drawn, at) =>
        across
          ? drawn.moveTo([at, 20]).lineTo([at, 20 + long])
          : drawn.moveTo([20, at]).lineTo([20 + long, at]),
      path(),
    );

  const numbers = (length: number) =>
    Array.from({ length: Math.floor(length / UNIT) - 1 }, (_, index) => (index + 1) * UNIT);

  const hair = { color: "#3A4556", width: 1 } as const;

  return (
    <Group>
      <Shape
        geometry={moved(rect(WIDTH - 40, HEIGHT - 40), [20, 20])}
        stroke={{ color: "#1E2633", width: 1 }}
      />
      <Shape geometry={ticks(WIDTH, 20, 4, true)} stroke={hair} />
      <Shape geometry={ticks(HEIGHT, 20, 4, false)} stroke={hair} />
      <Shape geometry={ticks(WIDTH, UNIT, 9, true)} stroke={hair} />
      <Shape geometry={ticks(HEIGHT, UNIT, 9, false)} stroke={hair} />
      {numbers(WIDTH).map((at) => (
        <Text
          key={`x-${at}`}
          font={mono}
          size={10}
          fill={MUTED}
          at={[at + 4, 31]}
          anchor={[0, 0.5]}
        >
          {String(at / UNIT)}
        </Text>
      ))}
      {numbers(HEIGHT).map((at) => (
        <Text
          key={`y-${at}`}
          font={mono}
          size={10}
          fill={MUTED}
          at={[33, at + 8]}
          anchor={[0, 0.5]}
        >
          {String(at / UNIT)}
        </Text>
      ))}
      <Shape
        geometry={path()
          .moveTo([60, 950])
          .lineTo([60, 958])
          .lineTo([60 + UNIT, 958])
          .lineTo([60 + UNIT, 950])}
        stroke={{ color: TEXT, width: 1.5 }}
      />
      <Text font={mono} size={12} fill={TEXT} at={[60 + UNIT + 12, 958]} anchor={[0, 0.5]}>
        1 u
      </Text>
      <Text font={mono} size={12} fill={MUTED} at={[WIDTH - 60, 958]} anchor={[1, 0.5]}>
        FIG. 1 FOUR LINE CHARGES, SEEN END ON
      </Text>
    </Group>
  );
};

const LEVELS = Array.from({ length: 13 }, (_, index) => (index - 6) * STEP).filter(
  (level) => level !== 0,
);

/** Without WebGPU: the equipotentials of the charges where they start, worked out when the scene builds. */
export const Fallback = () => (
  <Group clip={rect(WIDTH, HEIGHT)}>
    <Shape geometry={rect(WIDTH, HEIGHT)} fill={INK} />
    {LEVELS.map((value) => (
      <Shape
        key={`level-${value}`}
        geometry={equipotential(value, 8).reduce(
          (drawn, points) =>
            points.slice(1).reduce((more, point) => more.lineTo(point), drawn.moveTo(points[0]!)),
          path(),
        )}
        stroke={{ color: value > 0 ? WARM : COOL, width: 1.2 }}
        opacity={0.25 + 0.1 * Math.abs(value)}
      />
    ))}
  </Group>
);
