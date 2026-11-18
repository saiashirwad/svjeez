/** @jsxImportSource svjeez */
import {
  Align,
  Group,
  Run,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  enter,
  exit,
  rect,
  ref,
  scene,
  span,
  type Paint,
  type SceneElement,
  type Span,
} from "svjeez";
import { sans, theme } from "./style";

/**
 * A card that arrives, then fills in row by row. Layout containers place every box, text is measured when the scene
 * compiles, and the rows enter on spans cascaded from one beat, so moving that beat moves them all.
 */

const WIDTH = 340;
const PAD = 20;

const arrive = span(0.3, 0.6);
const [header, body, footer] = arrive.next(0.45, -0.25).cascade(3, 0.15);
const leave = span(4.4, 0.4);

/** A row's entrance: it rises 8px into place as it fades in. */
const rise = (when: Span) => enter(when, { from: { opacity: 0, offset: [0, 8] } });

/** A label centered on a rounded rect: `<Align to={…}>` puts the label's center on the rect's. */
const Pill = ({
  label,
  color,
}: {
  readonly label: string;
  readonly color: Paint;
}): SceneElement => {
  const pill = ref("pill");

  return (
    <Group>
      <Shape ref={pill} geometry={rect(64, 24, { radius: 12 })} fill={theme.raised} />
      <Align to={pill}>
        <Text font={sans} weight={600} size={12} fill={color}>
          {label}
        </Text>
      </Align>
    </Group>
  );
};

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
        <Group
          motion={[
            enter(arrive, { from: { opacity: 0, offset: [0, 24], scale: 0.96 } }),
            exit(leave, { to: { opacity: 0, offset: [0, -12] } }),
          ]}
        >
          <Shape
            geometry={rect(WIDTH, 184, { radius: 14 })}
            fill={theme.surface}
            stroke={{ color: theme.border, width: 1 }}
          />
          <Stack gap={14} padding={PAD}>
            <Stack direction="row" gap={12} align="center" motion={rise(header!)}>
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
              width={WIDTH - PAD * 2}
              fill={theme.muted}
              motion={rise(body!)}
            >
              Every run is laid out with its own face, so{" "}
              <Run weight={600} fill={theme.text}>
                bold words
              </Run>{" "}
              and <Run fill={theme.blue}>colored ones</Run> wrap with the text around them.
            </Text>
            <Stack direction="row" gap={8} motion={rise(footer!)}>
              <Pill label="+128" color={theme.green} />
              <Pill label="−42" color={theme.red} />
            </Stack>
          </Stack>
        </Group>
      </Align>
    </Group>
  ),
);
