import { mermaid } from "@svjeez/mermaid";
import { Group, Shape, Text, line, rect, span, track, typed, type SceneElement } from "svjeez";
import { Pivot } from "../blip";
import { Note } from "./note";
import { ACCENTS, Header, SHOTS, STAGE, mono, shown, theme } from "./kit";

const SOURCE = `flowchart TB
  push([Push]) --> build[Build]
  build --> test{Tests pass?}
  test -->|yes| ship([Ship it])
  test -->|no| fix[Fix]
  fix --> build`;

const PANEL = { x: STAGE.x + 50, y: STAGE.y + 70, w: 500, h: 270, bar: 44 } as const;
const SIZE = 19;
const ROW = SIZE * 1.75;
const typing = span(0.4, 1.6);
const reveal = span(2.1, 0.32);

const chart = mermaid(SOURCE, {
  font: mono,
  textSize: 17,
  reveal,
  colors: {
    background: theme.background,
    text: theme.text,
    line: theme.faint,
    muted: theme.muted,
    accent: theme.blue,
    highlight: theme.pink,
    roles: {
      input: ACCENTS[0],
      task: ACCENTS[1],
      tool: ACCENTS[3],
      output: ACCENTS[0],
      store: ACCENTS[1],
      decision: ACCENTS[2],
    },
  },
});

/** The diagram fits the right half of the stage, as large as it will go. */
const AREA = { x: 640, y: STAGE.y + 40, w: 520, h: STAGE.h - 80 } as const;
const fit = Math.min(AREA.w / chart.size[0], AREA.h / chart.size[1], 1.6);

const lines = SOURCE.split("\n");
const total = SOURCE.length;
let typedSoFar = 0;

/** Each line types in its share of the typing span, one after the other. */
const when = lines.map((text) => {
  const start = typing.start + (typing.over * typedSoFar) / total;
  typedSoFar += text.length;

  return span(start, (typing.over * text.length) / total);
});

/** Shot: Mermaid text types into a file, and the diagram it describes draws itself beside it. */
export const DiagramShot = (): SceneElement => {
  const { over } = SHOTS.diagram;

  return (
    <Group>
      <Header title="agents already speak mermaid" from="@svjeez/mermaid" over={over!} />
      <Group motion={shown(over!)}>
        <Group offset={[PANEL.x, PANEL.y]}>
          <Shape
            geometry={rect(PANEL.w, PANEL.h, { radius: 10 })}
            fill={theme.surface}
            stroke={{ color: theme.line, width: 1 }}
          />
          <Shape
            geometry={line([0, PANEL.bar], [PANEL.w, PANEL.bar])}
            stroke={{ color: theme.line, width: 1 }}
          />
          <Text font={mono} size={15} at={[20, PANEL.bar / 2]} anchor="left" fill={theme.muted}>
            deploy.mmd
          </Text>
          {lines.map((text, i) => (
            <Text
              font={mono}
              size={SIZE}
              at={[24, PANEL.bar + 36 + i * ROW]}
              anchor="baseline-left"
              fill={i === 0 ? theme.pink : theme.text}
            >
              {typed(track("").to(text, when[i]!))}
            </Text>
          ))}
        </Group>
        <Note
          text="same .mmd, now it moves"
          at={[PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h + 64]}
          from={1.9}
          size={34}
          tilt={-4}
          to={[40, -24]}
        />
        <Pivot
          around={[0, 0]}
          at={[
            AREA.x + (AREA.w - chart.size[0] * fit) / 2,
            AREA.y + (AREA.h - chart.size[1] * fit) / 2,
          ]}
          motion={{ scale: fit }}
        >
          {chart.node}
        </Pivot>
      </Group>
    </Group>
  );
};
