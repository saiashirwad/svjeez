/** @jsxImportSource svjeez/scene */
import { Group, Shape, Span, Stack, Text, canvas, rect, scene, span, track } from "svjeez/scene";
import { geistText } from "../fonts/faces";
import { mono, theme } from "../theme";

const WIDTH = 392;

/** The one word that changes color: it goes warm, holds, and comes back, every three seconds. */
const glowing = track(theme.cyan)
  .to(theme.orange, span(0.6, 0.5))
  .to(theme.cyan, span(2.2, 0.5))
  .loop(3);

/** Each word of the last line fades in after the one before it. */
const WORDS = ["One", "word", "at", "a", "time,", "on", "one", "line."];

const appear = (i: number) =>
  track(0)
    .to(1, span(0.5 + i * 0.22, 0.3))
    .to(0, span(5.4, 0.3));

export default scene({ size: [480, 300], duration: 6, theme, title: "Type, measured" }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Shape at={[24, 20]} geometry={rect(432, 260, { radius: 12 })} fill={theme.surface} />
    <Stack at={[44, 40]} gap={14}>
      <Text font={geistText} weight={600} size={24} fill={theme.text}>
        Type, measured
      </Text>
      <Text font={geistText} size={14} lineHeight={1.5} width={WIDTH} fill={theme.muted}>
        Every run is measured with its own face when the scene compiles, so{" "}
        <Span weight={600} fill={theme.text}>
          semibold words
        </Span>{" "}
        and <Span italic>an italic aside</Span> wrap with the text around them, a{" "}
        <Span fill={theme.green}>colored phrase keeps its place</Span>, and this word{" "}
        <Span weight={600} fill={glowing}>
          glows
        </Span>{" "}
        without moving a letter.
      </Text>
      <Text font={mono} size={13} fill={theme.text}>
        <Span fill={theme.magenta}>const</Span> <Span fill={theme.blue}>total</Span> ={" "}
        <Span fill={theme.orange}>42</Span>;
      </Text>
      <Text font={geistText} size={14} fill={theme.text}>
        {WORDS.map((word, i) => (
          <Span opacity={appear(i)}>{i === 0 ? word : ` ${word}`}</Span>
        ))}
      </Text>
    </Stack>
  </Group>
));
