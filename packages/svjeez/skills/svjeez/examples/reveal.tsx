/** @jsxImportSource svjeez */
import {
  Align,
  Center,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  exit,
  linear,
  radial,
  rect,
  scene,
  span,
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

const FEATHER = 60;

export default scene(
  {
    size: [480, 280],
    duration: 6,
    title: "Paint and masks",
    desc: "A gradient card opens from its corner like an iris while a gradient ring turns inside it, then a gradient title wipes on softly from the left.",
    theme,
    still: 3,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Stack gap={20} align="center" motion={exit(leave)}>
          <Center
            key="art"
            width={CARD[0]}
            height={CARD[1]}
            radius={16}
            fill={radial.across({ center: "top-left", stops: [theme.cyan, theme.blue] })}
            clip={track(circle(0)).to(circle(260), iris, ease.inOut)}
          >
            <Shape
              key="ring"
              geometry={ring}
              rotate={track(0).to(360, span(0, 3), ease.linear).loop(3)}
              fill={linear.across({ angle: 90, stops: ["#FFFFFF", "#FFFFFF33"] })}
            />
          </Center>
          <Text
            key="title"
            font={sans}
            weight={600}
            size={30}
            fill={linear.across({ stops: [theme.blue, theme.magenta] })}
            mask={(own) => (
              <Shape
                geometry={rect(own.width + FEATHER, own.height)}
                at={track<Vec>([-own.width - FEATHER, 0]).to([0, 0], wipe, ease.inOut)}
                fill={linear({
                  from: [own.width, 0],
                  to: [own.width + FEATHER, 0],
                  stops: [
                    [0, "#000000"],
                    [1, "#00000000"],
                  ],
                })}
              />
            )}
          >
            Paint and masks
          </Text>
        </Stack>
      </Align>
    </Group>
  ),
);
