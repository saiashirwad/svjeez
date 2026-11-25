import { Group, Run, Shape, Stack, Text, scene, span, track, typed, words } from "svjeez";
import { geistText } from "../fonts/faces";
import { mono, theme } from "../theme";

const WIDTH = 416;

const glowing = track(theme.text)
  .to(theme.magenta, span(0.6, 0.5))
  .to(theme.text, span(2.2, 0.5))
  .loop(3);

const sentence = track("")
  .to("One word at a time, on one line.", span(0.5, 1.6))
  .to("", span(5.3, 0.4));

const command = track("")
  .to("git commit -m 'drafts'", span(0.6, 1.1))
  .to("git commit -m '", span(2.3, 0.35))
  .to("git commit -m 'offline drafts'", span(2.9, 0.9))
  .to("", span(5.2, 0.5));

export default scene(
  { size: [480, 300], duration: 6, theme, title: "Type, measured" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Stack at={[32, 32]} gap={14}>
        <Text font={geistText} weight={600} size={24} fill={theme.text}>
          Type, measured
        </Text>
        <Text font={geistText} size={14} lineHeight={1.5} width={WIDTH} fill={theme.muted}>
          Every run is measured with its own face when the scene compiles, so{" "}
          <Run weight={600} fill={theme.text}>
            semibold words
          </Run>{" "}
          and <Run italic>an italic aside</Run> wrap with the text around them, a{" "}
          <Run fill={theme.blue}>colored phrase keeps its place</Run>, and this word{" "}
          <Run weight={600} fill={glowing}>
            glows
          </Run>{" "}
          without moving a letter.
        </Text>
        <Text font={mono} size={13} fill={theme.text}>
          <Run fill={theme.magenta}>const</Run> total = <Run fill={theme.blue}>42</Run>;
        </Text>
        <Text font={geistText} size={14} fill={theme.text}>
          {typed(sentence, { by: words })}
        </Text>
        <Text font={mono} size={13} fill={theme.text}>
          $ {typed(command, { caret: true })}
        </Text>
      </Stack>
    </Group>
  ),
);
