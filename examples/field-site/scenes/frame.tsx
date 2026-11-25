import { Group, Sequence, Shape, Text, moved, path, rect, span, track } from "svjeez";
import { intro } from "./annotations";
import { HEIGHT, STEP, UNIT, WIDTH, equipotential } from "./field";
import { COOL, INK, MUTED, TEXT, WARM, mono } from "./style";

/** The engineering frame: a hairline border, rulers along the top and left in u, and a scale bar. On the intro clock the border and ticks draw in and the numbers follow them. */
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

  /** Drawn in from 0 to 1 over `over` seconds from `start`. */
  const drawn = (start: number, over: number) => track(0).to(1, span(start, over));

  /** A number fades in as the tick beside it is drawn: `at` along a ruler of `length` drawn from 0.1s for 0.8s. */
  const shown = (at: number, length: number) =>
    track(0).to(1, span(0.1 + (0.8 * at) / length, 0.25));

  return (
    <Sequence clock={intro}>
      <Group>
        <Shape
          geometry={moved(rect(WIDTH - 40, HEIGHT - 40), [20, 20])}
          stroke={{ color: "#1E2633", width: 1 }}
          draw={drawn(0, 1)}
        />
        <Shape geometry={ticks(WIDTH, 20, 4, true)} stroke={hair} draw={drawn(0.1, 0.8)} />
        <Shape geometry={ticks(HEIGHT, 20, 4, false)} stroke={hair} draw={drawn(0.1, 0.8)} />
        <Shape geometry={ticks(WIDTH, UNIT, 9, true)} stroke={hair} draw={drawn(0.1, 0.8)} />
        <Shape geometry={ticks(HEIGHT, UNIT, 9, false)} stroke={hair} draw={drawn(0.1, 0.8)} />
        {numbers(WIDTH).map((at) => (
          <Text
            key={`x-${at}`}
            opacity={shown(at, WIDTH)}
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
            opacity={shown(at, HEIGHT)}
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
          draw={drawn(0.6, 0.4)}
        />
        <Text
          font={mono}
          size={12}
          fill={TEXT}
          at={[60 + UNIT + 12, 958]}
          anchor={[0, 0.5]}
          opacity={shown(HEIGHT, HEIGHT)}
        >
          1 u
        </Text>
      </Group>
    </Sequence>
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
