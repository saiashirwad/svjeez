import { Axes, Tex, brace, plane } from "@svjeez/math";
import { Group, Shape, Stack, Text, enter, exit, morph, scene, span, track } from "svjeez";
import { mono, theme } from "../theme";

const D = 9;
const FORMULA = { size: 60, at: [48, 280] as const };
const colors = { a: theme.blue, b: theme.magenta, two: theme.orange };

const square = String.raw`(\textcolor{a}{a}+\textcolor{b}{b})^2`;
const expanded = String.raw`\textcolor{a}{a^2} + \cssId{cross}{\textcolor{two}{2}\textcolor{a}{a}\textcolor{b}{b}} + \textcolor{b}{b^2}`;
const cross = Tex.measure(expanded, { size: FORMULA.size }).part("cross");

const graph = plane({ x: [-4, 2], y: [0, 9], size: [440, 340] });

const fadeIn = span(0.2, 0.5);
const drawn = span(0.6, 1.6);
const change = drawn.next(1);
const note = change.next(0.5);
const leave = span(D - 0.6, 0.5);

export default scene(
  {
    size: [960, 540],
    duration: D,
    title: "Expanding (a + b)²",
    desc: "(a+b)^2 morphs into a^2+2ab+b^2 with a brace on the cross term, while a curve of (a+1)^2 draws beside it for b = 1.",
    theme,
    still: 6,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group motion={[enter(fadeIn), exit(leave)]}>
        {morph(
          <Tex size={FORMULA.size} at={FORMULA.at} fill={theme.text} colors={colors}>
            {square}
          </Tex>,
          <Tex size={FORMULA.size} at={FORMULA.at} fill={theme.text} colors={colors}>
            {expanded}
          </Tex>,
          change,
        )}
        <Stack
          gap={4}
          align="center"
          at={[
            FORMULA.at[0] + cross.x + cross.width / 2,
            FORMULA.at[1] + cross.y + cross.height + 6,
          ]}
          anchor="top"
          motion={[enter(note), exit(note.next(0.5, 2))]}
        >
          <Shape
            geometry={brace(cross.width, { height: 12 })}
            stroke={{ color: theme.orange, width: 1.5, cap: "round", join: "round" }}
          />
          <Text font={mono} size={18} fill={theme.muted}>
            cross term
          </Text>
        </Stack>
        <Group offset={[462, 84]}>
          <Axes
            plane={graph}
            ticks={[1, 3]}
            stroke={{ color: theme.muted, width: 1 }}
            grid={{ color: theme.border, width: 0.5 }}
            labels={{ font: mono, size: 14, fill: theme.muted }}
          />
          <Tex size={24} at={graph.point([-3.2, 8.2])} fill={theme.blue}>
            {String.raw`b = 1:\ (a+1)^2`}
          </Tex>
          <Shape
            geometry={graph.plot((a) => (a + 1) ** 2)}
            stroke={{ color: theme.blue, width: 2.5, cap: "round", join: "round" }}
            draw={track(0).to(1, drawn)}
          />
        </Group>
      </Group>
    </Group>
  ),
);
