/** @jsxImportSource svjeez */
import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  ease,
  exit,
  linear,
  radial,
  rect,
  ref,
  scene,
  span,
  spin,
  subtract,
  track,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const CARD: Vec = [220, 120];

const iris = span(0.3, 1.2);
const wipe = iris.next(1, -0.4);
const leave = span(5.3, 0.5);

const ring = subtract(circle(30), circle(20));

const soft = linear({
  from: [300, 0],
  to: [360, 0],
  stops: [
    [0, "#000000"],
    [1, "#00000000"],
  ],
});

export default scene(
  {
    size: [480, 280],
    duration: 6,
    title: "Paint and masks",
    desc: "A gradient card opens from its corner like an iris while a gradient ring turns inside it, then a gradient title wipes on softly from the left.",
    theme,
    reducedMotion: 3,
  },
  () => {
    const card = ref("card");

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Align>
          <Stack gap={20} align="center" motion={exit(leave)}>
            <Group key="art" clip={track(circle(0)).to(circle(260), iris, ease.inOut)}>
              <Shape
                ref={card}
                geometry={rect(CARD[0], CARD[1], { radius: 16 })}
                fill={radial.across({ center: "top-left", stops: [theme.cyan, theme.blue] })}
              />
              <Align to={card}>
                <Shape
                  key="ring"
                  geometry={ring}
                  rotate={spin({ every: 3 })}
                  fill={linear.across({ angle: 90, stops: ["#FFFFFF", "#FFFFFF33"] })}
                />
              </Align>
            </Group>
            <Text
              key="title"
              font={sans}
              weight={600}
              size={30}
              fill={linear.across({ stops: [theme.blue, theme.magenta] })}
              mask={
                <Shape
                  geometry={rect(360, 60)}
                  at={track<Vec>([-360, -10]).to([0, -10], wipe, ease.inOut)}
                  fill={soft}
                />
              }
            >
              Paint and masks
            </Text>
          </Stack>
        </Align>
      </Group>
    );
  },
);
