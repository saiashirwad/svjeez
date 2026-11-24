import {
  Group,
  Sequence,
  Shape,
  Text,
  circle,
  clock,
  ease,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const open = clock("open", span(1, 0.5));
const grow = clock("grow", span(2, 1.2));

const heights = [34, 58, 46, 78, 62];
const rows = ["Notifications", "Dark mode", "Autosave"];

const Row = ({
  label,
  y,
  index,
}: {
  readonly label: string;
  readonly y: number;
  readonly index: number;
}): SceneElement => {
  const at = index * 0.08;
  const settle = span(at, 0.25);

  return (
    <Group
      offset={track<Vec>([-12, y]).to([0, y], settle, ease.out)}
      opacity={track(0).to(1, settle, ease.out)}
    >
      <Shape geometry={rect(188, 30, { radius: 8 })} fill={theme.raised} />
      <Text font={geist} size={13} at={[14, 19]} anchor="baseline-left" fill={theme.text}>
        {label}
      </Text>
    </Group>
  );
};

const Bar = ({
  x,
  height,
  index,
}: {
  readonly x: number;
  readonly height: number;
  readonly index: number;
}): SceneElement => (
  <Shape
    geometry={rect(24, height, { radius: 5 })}
    at={[x, 120]}
    anchor="bottom-left"
    origin="at"
    fill={theme.blue}
    scale={track<Vec>([1, 0]).to([1, 1], span(index * 0.15, 0.6), ease.out)}
  />
);

export default scene(
  {
    size: [480, 300],
    duration: 4,
    title: "Clocks",
    desc: "A settings card in three parts: a panel that slides open and a bar chart that grows, each on a clock that page code can play, reverse or scrub, and a status dot that pulses on the scene's own clock.",
    theme,
    loop: false,
    still: 3.4,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(440, 260, { radius: 18 })}
        at={[20, 20]}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Group offset={[44, 44]}>
        <Text font={geist} weight={600} size={16} fill={theme.text}>
          Settings
        </Text>
        <Sequence clock={open}>
          <Shape
            geometry={rect(40, 22, { radius: 11 })}
            at={[148, -4]}
            fill={track(theme.raised).to(theme.green, span(0, 0.5))}
          />
          <Shape
            geometry={circle(8)}
            at={track<Vec>([157, 7]).to([175, 7], span(0, 0.5), ease.inOut)}
            anchor="center"
            fill={theme.background}
          />
          <Group offset={[0, 30]}>
            {rows.map((label, index) => (
              <Row key={label} label={label} y={index * 38} index={index} />
            ))}
          </Group>
        </Sequence>
      </Group>
      <Group offset={[268, 44]}>
        <Text font={geist} weight={600} size={16} fill={theme.text}>
          Usage
        </Text>
        <Group offset={[0, 40]}>
          <Shape geometry={rect(176, 1.5)} at={[0, 120]} fill={theme.border} />
          <Sequence clock={grow}>
            {heights.map((height, index) => (
              <Bar key={String(index)} x={index * 36} height={height} index={index} />
            ))}
          </Sequence>
        </Group>
      </Group>
      <Group offset={[44, 250]}>
        <Shape
          geometry={circle(5)}
          at={[5, 5]}
          anchor="center"
          fill={theme.green}
          scale={track(1)
            .to(1.5, span(0, 0.8), ease.inOut)
            .to(1, span(0.8, 0.8), ease.inOut)
            .loop(1.6)}
          opacity={track(1)
            .to(0.5, span(0, 0.8), ease.inOut)
            .to(1, span(0.8, 0.8), ease.inOut)
            .loop(1.6)}
        />
        <Text font={mono} size={11} at={[18, 9]} anchor="baseline-left" fill={theme.muted}>
          synced
        </Text>
      </Group>
    </Group>
  ),
);
