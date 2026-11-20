import { Code } from "@svjeez/code";
import { palette } from "@svjeez/code/palettes";
import { Group, Shape, Text, line, morph, rect, span, type SceneElement } from "svjeez";
import { Note } from "./note";
import { Header, SHOTS, STAGE, mono, shown, spring, theme } from "./kit";

const SIZE = 25;

/** Geist's syntax colors: plain text in the foreground, keywords pink, calls purple, numbers blue, strings green. */
export const geistCode = palette("film", {
  light: {
    plain: "#171717",
    comment: "#8F8F8F",
    punctuation: "#8F8F8F",
    keyword: "#C41562",
    string: "#107D32",
    number: "#005FF2",
    constant: "#005FF2",
    variable: "#171717",
    function: "#7D00CC",
    type: "#7D00CC",
    tag: "#C41562",
    inserted: "#107D32",
    deleted: "#C41562",
  },
  dark: {
    plain: "#EDEDED",
    comment: "#8F8F8F",
    punctuation: "#8F8F8F",
    keyword: "#FF4D8D",
    string: "#5AD077",
    number: "#47A8FF",
    constant: "#47A8FF",
    variable: "#EDEDED",
    function: "#C472FB",
    type: "#C472FB",
    tag: "#FF4D8D",
    inserted: "#5AD077",
    deleted: "#FF4D8D",
  },
});

const before = `const y = track(0)
  .to(-28, span(0.4, 0.6), ease.out)
  .to(0, span(1.4, 0.6), ease.out);`;

const after = `const spring = ease.spring({ stiffness: 190, damping: 16 });
const y = track(0)
  .to(-28, span(0.4, spring.settle), spring)
  .to(0, span(1.4, spring.settle), spring);`;

const PANEL = { x: STAGE.x + 60, y: STAGE.y + 90, w: STAGE.w - 120, h: 300, bar: 48 } as const;

/** A code block as Geist draws one: a hairline frame, the file's name in a strip over it. */
const Panel = (): SceneElement => (
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
      motion.ts
    </Text>
  </Group>
);

/** The lines that stay are keyed the same, so they slide to their new places; the lines that change swap in place. */
const Listing = ({
  source,
  keys,
}: {
  readonly source: string;
  readonly keys: readonly string[];
}): SceneElement => (
  <Code
    lang="ts"
    font={mono}
    size={SIZE}
    lineHeight={1.6}
    palette={geistCode}
    keys={keys}
    at={[PANEL.x + 32, PANEL.y + 82]}
  >
    {source}
  </Code>
);

/** Shot 3: the same three lines get a spring, and every line that survives the edit moves to where it now lives. */
export const CodeShot = (): SceneElement => {
  const { over } = SHOTS.code;

  return (
    <Group>
      <Header title="Code that refactors itself." from="@svjeez/code" over={over!} />
      <Group motion={shown(over!)}>
        <Panel />
        <Note
          text="no keyframes, just keys"
          at={[STAGE.x + STAGE.w / 2, PANEL.y + PANEL.h + 70]}
          from={3.2}
          tilt={-2}
        />
        {morph(
          <Listing source={before} keys={["y", "up-eased", "down-eased"]} />,
          <Listing source={after} keys={["spring", "y", "up-sprung", "down-sprung"]} />,
          span(2.4, spring.settle),
          { curve: spring, stagger: 0.06 },
        )}
      </Group>
    </Group>
  );
};
