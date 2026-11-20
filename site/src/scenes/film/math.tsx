import { Tex } from "@svjeez/math";
import { Group, morph, span, type SceneElement, type Vec } from "svjeez";
import { Note } from "./note";
import { ACCENTS, Header, SHOTS, STAGE, shown, theme } from "./kit";

const SIZE = 64;
const colors = { a: ACCENTS[0], b: ACCENTS[1], c: ACCENTS[2], x: ACCENTS[3] };

const a = String.raw`\textcolor{a}{a}`;
const b = String.raw`\textcolor{b}{b}`;
const c = String.raw`\textcolor{c}{c}`;
const x = String.raw`\textcolor{x}{x}`;

const steps = [
  String.raw`${a}${x}^2 + ${b}${x} + ${c} = 0`,
  String.raw`${x}^2 + \frac{${b}}{${a}}${x} = -\frac{${c}}{${a}}`,
  String.raw`${x} = \frac{-${b} \pm \sqrt{${b}^2 - 4${a}${c}}}{2${a}}`,
];

/** Each step sits in the middle of the stage, wherever its own box falls. */
const centered = (source: string): Vec => {
  const box = Tex.measure(source, { size: SIZE });

  return [
    STAGE.x + STAGE.w / 2 - box.width / 2 - box.x,
    STAGE.y + STAGE.h / 2 - box.height / 2 - box.y,
  ];
};

/** Shot 4: a quadratic rearranges into its formula, each letter keeping its color as it travels. */
export const MathShot = (): SceneElement => {
  const { over } = SHOTS.math;

  return (
    <Group>
      <Header title="And math, typeset at build time." from="@svjeez/math" over={over!} />
      <Group motion={shown(over!)}>
        <Note
          text="no MathJax in your browser"
          at={[STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h - 70]}
          from={1.1}
          tilt={-2}
        />
        {morph.between(
          steps.map((source) => (
            <Tex size={SIZE} at={centered(source)} fill={theme.text} colors={colors}>
              {source}
            </Tex>
          )),
          [span(1.5, 1), span(3.2, 1.1)],
        )}
      </Group>
    </Group>
  );
};
