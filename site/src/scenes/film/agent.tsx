import { Code } from "@svjeez/code";
import { mermaid } from "@svjeez/mermaid";
import { Pivot } from "../blip";
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
import { Session } from "./session";
import type { Child } from "svjeez/tools";
import { Header, SHOTS, STAGE, mono, shown, theme } from "./kit";

// The words, kept together so the copy can change without touching the shot.
export const COPY = {
  title: "it's code, so your agent writes it",
  label: "npx svjeez skill --install",
  prompt: "animate our cache hit/miss flow for the readme",
  calls: [
    { tool: "Write", input: "cache-flow.tsx", result: "wrote 31 lines" },
    { tool: "Bash", input: "svjeez check cache-flow.tsx", result: "0 issues" },
    { tool: "Bash", input: "svjeez frames cache-flow.tsx", result: "6 pngs" },
    { tool: "Read", input: "frames/", result: "layout looks right" },
  ],
  reply: "wrote cache-flow.svg · 18 KB",
  file: "cache-flow.tsx",
  result: "cache-flow.svg",
  note: "never opened a browser",
} as const;

const SESSION = { x: STAGE.x + 40, y: STAGE.y + 40, w: 500, h: STAGE.h - 80 } as const;
const SOURCE = { x: 660, y: STAGE.y + 40, w: 500, h: 200, bar: 40 } as const;
const RESULT = { x: 660, y: STAGE.y + 260, w: 500, h: 200, bar: 40 } as const;

const typing = span(0.6, 1.3);

const steps = span(2.0, 0.25).cascade(COPY.calls.length + 1, 0.75);
const writing = span(steps[0]!.start + 0.1, 1.2);
const shipped = steps.at(-1)!.start;

const FLOW = `flowchart LR
  req([request]) --> cache{cache}
  cache -->|hit · 2 ms| res([response])
  cache -->|miss| origin[origin · 48 ms]
  origin -->|write back| cache`;

const code = `export default scene(opts, () => (
  <Align>{mermaid(\`flowchart LR
    req([request]) --> cache{cache}
    cache -->|hit · 2 ms| res([response])
    cache -->|miss| origin[origin · 48 ms]
  \`, { font, reveal }).node}</Align>
));`;

const flow = mermaid(FLOW, {
  font: mono,
  textSize: 15,
  reveal: span(shipped + 0.3, 0.3),
  colors: {
    background: theme.surface,
    text: theme.text,
    line: theme.faint,
    muted: theme.muted,
    accent: theme.green,
    highlight: theme.pink,
    roles: {
      input: theme.blue,
      task: theme.purple,
      tool: theme.teal,
      output: theme.green,
      store: theme.purple,
      decision: theme.pink,
    },
  },
});

/** The diagram fits the result panel under its strip. */
const room = { w: RESULT.w - 32, h: RESULT.h - RESULT.bar - 20 } as const;
const fit = Math.min(room.w / flow.size[0], room.h / flow.size[1]);

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
        <Session
          at={[SESSION.x, SESSION.y]}
          size={[SESSION.w, SESSION.h]}
          title="~/repo"
          prompt={COPY.prompt}
          calls={COPY.calls}
          reply={COPY.reply}
          typing={typing}
          steps={steps}
        />
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
            <Pivot
              around={[0, 0]}
              at={[
                (RESULT.w - flow.size[0] * fit) / 2,
                RESULT.bar + 10 + (room.h - flow.size[1] * fit) / 2,
              ]}
              motion={{ scale: fit }}
            >
              {flow.node}
            </Pivot>
          </Panel>
        </Group>
        <Note
          text={COPY.note}
          at={[RESULT.x + RESULT.w / 2, RESULT.y + RESULT.h + 32]}
          from={shipped + 0.4}
          size={28}
          tilt={-3}
        />
      </Group>
    </Group>
  );
};
