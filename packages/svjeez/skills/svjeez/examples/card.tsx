/** @jsxImportSource svjeez */
import {
  Align,
  Center,
  Group,
  Run,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  enter,
  exit,
  scene,
  span,
  type Paint,
  type SceneElement,
  type Span,
} from "svjeez";
import { sans, theme } from "./style";

const TEXT = 300;

const arrive = span(0.3, 0.6);
const [header, body, footer] = arrive.next(0.45, -0.25).cascade(3, 0.15);
const leave = span(4.4, 0.4);

const rise = (when: Span) => enter(when, { from: { opacity: 0, offset: [0, 8] } });

const Pill = ({
  label,
  color,
}: {
  readonly label: string;
  readonly color: Paint;
}): SceneElement => (
  <Center width={64} height={24} radius={12} fill={theme.raised}>
    <Text font={sans} weight={600} size={12} fill={color}>
      {label}
    </Text>
  </Center>
);

export default scene(
  {
    size: [480, 260],
    duration: 5,
    title: "A card",
    desc: "A pull request card rises into place, then its header, its description and its line counts appear one after another, and the card leaves before the loop starts again.",
    theme,
    reducedMotion: 2,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Stack
          gap={14}
          padding={20}
          radius={14}
          fill={theme.surface}
          stroke={{ color: theme.border, width: 1 }}
          motion={[
            enter(arrive, { from: { opacity: 0, offset: [0, 24], scale: 0.96 } }),
            exit(leave, { to: { opacity: 0, offset: [0, -12] } }),
          ]}
        >
          <Stack direction="row" gap={12} align="center" motion={rise(header)}>
            <Shape geometry={circle(18)} fill={theme.blue} />
            <Stack gap={2}>
              <Text font={sans} weight={600} size={15} fill={theme.text}>
                Measure text at compile time
              </Text>
              <Text font={sans} size={12} fill={theme.muted}>
                #212 opened by ada · 3 files
              </Text>
            </Stack>
          </Stack>
          <Text
            font={sans}
            size={13}
            lineHeight={1.45}
            width={TEXT}
            fill={theme.muted}
            motion={rise(body)}
          >
            Every run is laid out with its own face, so{" "}
            <Run weight={600} fill={theme.text}>
              bold words
            </Run>{" "}
            and <Run fill={theme.blue}>colored ones</Run> wrap with the text around them.
          </Text>
          <Stack direction="row" gap={8} motion={rise(footer)}>
            <Pill label="+128" color={theme.green} />
            <Pill label="−42" color={theme.red} />
          </Stack>
        </Stack>
      </Align>
    </Group>
  ),
);
