import { Code } from "@svjeez/code";
import { Chart, bars } from "@svjeez/charts";
import {
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  line,
  rect,
  span,
  track,
  typed,
  type SceneElement,
} from "svjeez";
import { geistCode } from "./code";
import { Note } from "./note";
import type { Child } from "svjeez/tools";
import { Header, SHOTS, STAGE, mono, shown, theme } from "./kit";

// The words, kept together so the copy can change without touching the shot.
export const COPY = {
  title: "You describe it. An agent writes it.",
  label: "npx svjeez skill --install",
  prompt: "make an animated chart of our weekly deploys for the README",
  steps: [
    "wrote deploys.tsx",
    "svjeez check · 0 problems",
    "svjeez frames · looked at 6",
    "wrote deploys.svg · 14 KB",
  ],
  file: "deploys.tsx",
  result: "deploys.svg",
  note: "about a minute, start to end",
} as const;

const SESSION = { x: STAGE.x + 40, y: STAGE.y + 40, w: 500, h: STAGE.h - 80, bar: 44 } as const;
const SOURCE = { x: 660, y: STAGE.y + 40, w: 500, h: 200, bar: 40 } as const;
const RESULT = { x: 660, y: STAGE.y + 260, w: 500, h: 200, bar: 40 } as const;

const typing = span(0.6, 1.3);

/** The prompt broken into lines that fit the session, each typed after the one before. */
const prompt = COPY.prompt.split(" ").reduce<string[]>((lines, word) => {
  const last = lines.at(-1);

  if (last !== undefined && `${last} ${word}`.length <= 38)
    lines[lines.length - 1] = `${last} ${word}`;
  else lines.push(word);

  return lines;
}, []);

let typedSoFar = typing.start;

/** Each line of the prompt types in its share of the typing, after the one before. */
const typedAt = prompt.map((text) => {
  const over = (typing.over * text.length) / COPY.prompt.length;
  const start = typedSoFar;

  typedSoFar += over;

  return { start, over, end: start + over };
});

const steps = span(2.0, 0.25).cascade(COPY.steps.length, 0.75);
const writing = span(steps[0]!.start + 0.1, 1.2);
const shipped = steps.at(-1)!.start;

const code = `export default scene({ size: [480, 160] }, () => (
  <Chart x={{ kind: "band", domain: weeks }}
    series={[bars(deploys, {
      draw: track(0).to(1, span(0.3, 1.2)),
    })]} />
));`;

const weeks = [
  ["W1", 12],
  ["W2", 18],
  ["W3", 15],
  ["W4", 24],
  ["W5", 21],
  ["W6", 31],
] as const;

/** A hairline panel with a strip on top naming what it holds. */
const Panel = ({
  at,
  w,
  h,
  bar,
  name,
  children,
}: {
  readonly at: readonly [number, number];
  readonly w: number;
  readonly h: number;
  readonly bar: number;
  readonly name: string;
  readonly children?: Child;
}): SceneElement => (
  <Group offset={[at[0], at[1]]}>
    <Shape
      geometry={rect(w, h, { radius: 10 })}
      fill={theme.surface}
      stroke={{ color: theme.line, width: 1 }}
    />
    <Shape geometry={line([0, bar], [w, bar])} stroke={{ color: theme.line, width: 1 }} />
    <Text font={mono} size={14} at={[18, bar / 2]} anchor="left" fill={theme.muted}>
      {name}
    </Text>
    {children}
  </Group>
);

/** The shot the film is about: a request goes in, the agent writes and checks a scene, and an SVG comes out. */
export const AgentShot = (): SceneElement => {
  const { over } = SHOTS.agent;

  return (
    <Group>
      <Header title={COPY.title} from={COPY.label} over={over!} />
      <Group motion={shown(over!, 0.2)}>
        <Panel
          at={[SESSION.x, SESSION.y]}
          w={SESSION.w}
          h={SESSION.h}
          bar={SESSION.bar}
          name="agent"
        >
          <Text
            font={mono}
            size={17}
            at={[20, SESSION.bar + 40]}
            anchor="baseline-left"
            fill={theme.muted}
          >
            {">"}
          </Text>
          {prompt.map((text, i) => (
            <Text
              font={mono}
              size={17}
              at={[42, SESSION.bar + 40 + i * 27]}
              anchor="baseline-left"
              fill={theme.text}
            >
              {typed(track("").to(text, span(typedAt[i]!.start, typedAt[i]!.over)), {
                caret: {
                  opacity: track(0)
                    .to(1, span(typedAt[i]!.start, 0.01))
                    .to(0, span(typedAt[i]!.end + 0.25, 0.01)),
                },
              })}
            </Text>
          ))}
          {COPY.steps.map((step, i) => (
            <Group
              offset={[20, SESSION.bar + 140 + i * 40]}
              motion={enter(steps[i]!, { from: { opacity: 0, offset: [0, 6] }, curve: ease.out })}
            >
              <Shape
                geometry={circle(4)}
                at={[5, -6]}
                anchor="center"
                fill={i === COPY.steps.length - 1 ? theme.green : theme.faint}
              />
              <Text font={mono} size={16} at={[20, 0]} anchor="baseline-left" fill={theme.text}>
                {step}
              </Text>
            </Group>
          ))}
        </Panel>
        <Panel
          at={[SOURCE.x, SOURCE.y]}
          w={SOURCE.w}
          h={SOURCE.h}
          bar={SOURCE.bar}
          name={COPY.file}
        >
          <Code
            lang="tsx"
            font={mono}
            size={13}
            lineHeight={1.55}
            palette={geistCode}
            at={[18, SOURCE.bar + 16]}
            typing={writing}
          >
            {code}
          </Code>
        </Panel>
        <Group
          motion={enter(span(shipped, 0.4), {
            from: { opacity: 0, offset: [0, 10] },
            curve: ease.out,
          })}
        >
          <Panel
            at={[RESULT.x, RESULT.y]}
            w={RESULT.w}
            h={RESULT.h}
            bar={RESULT.bar}
            name={COPY.result}
          >
            <Chart
              at={[44, RESULT.bar + 18]}
              size={[RESULT.w - 76, RESULT.h - RESULT.bar - 50]}
              x={{ kind: "band", domain: weeks.map(([week]) => week), padding: 0.3 }}
              y={{ ticks: 3 }}
              series={[
                bars([...weeks], {
                  color: theme.blue,
                  radius: 3,
                  draw: track(0).to(1, span(shipped + 0.3, 1.1), ease.out),
                }),
              ]}
              font={mono}
              textSize={11}
              axis={theme.line}
              label={theme.faint}
              grid={{ color: theme.line, width: 1 }}
            />
          </Panel>
        </Group>
        <Note
          text={COPY.note}
          at={[SESSION.x + SESSION.w / 2, SESSION.y + SESSION.h - 30]}
          from={shipped + 0.4}
          size={30}
          tilt={-3}
        />
      </Group>
    </Group>
  );
};
