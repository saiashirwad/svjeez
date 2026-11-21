import {
  Group,
  Sequence,
  Shape,
  Text,
  circle,
  clock,
  ease,
  polygon,
  rect,
  scene,
  span,
  track,
  type Anim,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

// Four stops half a second apart: page code rests the clock at 0, 1/3, 2/3 or 1.
const step = clock("step", span(0.6, 1.5));

const STOP = 0.5;

const steps: readonly { readonly name: string; readonly color: Paint }[] = [
  { name: "Plan", color: theme.blue },
  { name: "Build", color: theme.orange },
  { name: "Test", color: theme.cyan },
  { name: "Ship", color: theme.green },
];

// Sixteen points each, so the icons blend into one another.
const icon = (reach: (point: number) => number) =>
  polygon(
    ...Array.from({ length: 16 }, (_, k): Vec => {
      const angle = (k * Math.PI) / 8 - Math.PI / 2;

      return [reach(k) * Math.cos(angle), reach(k) * Math.sin(angle)];
    }),
  );

const icons = [
  icon(() => 30),
  icon((k) => (k % 4 === 0 ? 40 : 28)),
  icon((k) => (k % 8 === 0 ? 40 : 22)),
  icon((k) => (k % 2 === 0 ? 40 : 18)),
];

const BAR = 360;

const Button = ({
  name,
  label,
  x,
  main,
  dim,
}: {
  readonly name: string;
  readonly label: string;
  readonly x: number;
  readonly main: boolean;
  readonly dim: Anim<number>;
}): SceneElement => (
  <Group hit={name} offset={[x, 206]}>
    <Shape
      geometry={rect(96, 36, { radius: 10 })}
      fill={main ? theme.blue : theme.raised}
      opacity={dim}
    />
    <Text
      font={geist}
      weight={600}
      size={14}
      at={[48, 23]}
      anchor="baseline"
      fill={main ? theme.background : theme.text}
    >
      {label}
    </Text>
  </Group>
);

// The machines page inlines several scenes, so each keeps its ids to itself.
export const prefix = "stepper-";

export default scene(
  {
    size: [480, 270],
    duration: 3,
    title: "Stepper",
    desc: "A four-step progress on one clock with four stops: an icon morphs from step to step, a bar fills and the label changes. Page code rests the clock at a stop and moves it with Back and Next, which stop at the ends.",
    theme,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape geometry={rect(BAR, 6, { radius: 3 })} at={[60, 36]} fill={theme.raised} />
      <Sequence clock={step}>
        <Shape
          geometry={rect(BAR, 6, { radius: 3 })}
          at={[60, 36]}
          origin="at"
          fill={theme.blue}
          scale={track<Vec>([0, 1])
            .to([1 / 3, 1], span(0, STOP), ease.linear)
            .to([2 / 3, 1], span(STOP, STOP), ease.linear)
            .to([1, 1], span(2 * STOP, STOP), ease.linear)}
        />
        {steps.map(({ name }, index) => (
          <Shape
            key={`dot-${name}`}
            geometry={circle(9)}
            at={[60 + (index * BAR) / 3, 39]}
            anchor="center"
            fill={
              index === 0
                ? theme.blue
                : track(theme.raised).to(theme.blue, span(index * STOP - 0.2, 0.2))
            }
          />
        ))}
        <Shape
          geometry={track(icons[0]!)
            .to(icons[1]!, span(0, STOP), ease.inOut)
            .to(icons[2]!, span(STOP, STOP), ease.inOut)
            .to(icons[3]!, span(2 * STOP, STOP), ease.inOut)}
          at={[240, 118]}
          anchor="center"
          fill={track(steps[0]!.color)
            .to(steps[1]!.color, span(0, STOP))
            .to(steps[2]!.color, span(STOP, STOP))
            .to(steps[3]!.color, span(2 * STOP, STOP))}
        />
        {steps.map(({ name }, index) => {
          const arrive = index === 0 ? track(1) : track(0).to(1, span(index * STOP - 0.2, 0.2));

          return (
            <Text
              key={`label-${name}`}
              font={geist}
              weight={600}
              size={17}
              at={[240, 188]}
              anchor="baseline"
              fill={theme.text}
              opacity={index === steps.length - 1 ? arrive : arrive.to(0, span(index * STOP, 0.2))}
            >
              {`${index + 1}. ${name}`}
            </Text>
          );
        })}
        <Button
          name="back"
          label="Back"
          x={140}
          main={false}
          dim={track(0.4).to(1, span(0, 0.2))}
        />
        <Button
          name="next"
          label="Next"
          x={244}
          main
          dim={track(1).to(0.4, span(2 * STOP + 0.3, 0.2))}
        />
      </Sequence>
    </Group>
  ),
);
