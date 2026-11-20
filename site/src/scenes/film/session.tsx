import {
  Group,
  Run,
  Shape,
  Text,
  circle,
  ease,
  enter,
  exit,
  line,
  path,
  rect,
  span,
  track,
  typed,
  words,
  type SceneElement,
  type Span,
} from "svjeez";
import { mono, theme } from "./kit";

// A coding agent's terminal session, drawn the way Claude Code draws one: the prompt typed into a box at the bottom,
// sent up as a message, then each tool call as a dot and a name with its result hanging under it, and a little
// spinner with a made-up verb while it works. The glyphs are shapes, since the film's mono font has none of them.

export interface Call {
  /** The tool and what it was given, as in Bash(svjeez check scene.tsx). */
  readonly tool: string;
  readonly input: string;
  readonly result: string;
}

interface SessionProps {
  readonly at: readonly [number, number];
  readonly size: readonly [number, number];
  readonly title: string;
  readonly prompt: string;
  readonly calls: readonly Call[];
  /** What the agent says when it is done. */
  readonly reply: string;
  readonly typing: Span;
  /** When each call, then the reply, shows up. */
  readonly steps: readonly Span[];
  /** Where the sent message sits, below anything drawn above it; the calls follow. */
  readonly top?: number;
  /** Drawn at the top of the session, above the conversation. */
  readonly children?: SceneElement;
}

const SIZE = 15;
const BAR = 40;

const appear = (when: Span) =>
  enter(when, { from: { opacity: 0, offset: [0, 4] }, curve: ease.out });

/** The ⎿ that hangs a result under its call. */
const hook = path().moveTo([0, -12]).lineTo([0, -5]).lineTo([8, -5]);

/** The spinner's ✻: six spokes, turning. */
export const Spinner = (): SceneElement => (
  <Group motion={{ rotate: track(0).to(180, span(0, 1.2), ease.linear).loop(1.2) }}>
    {[0, 60, 120].map((turn) => (
      <Shape
        geometry={line([-6, 0], [6, 0])}
        stroke={{ color: theme.clay, width: 2.2, cap: "round" }}
        rotate={turn}
      />
    ))}
  </Group>
);

export const Session = ({
  at,
  size: [w, h],
  title,
  prompt,
  calls,
  reply,
  typing,
  steps,
  top = BAR + 36,
  children,
}: SessionProps): SceneElement => {
  const sent = typing.start + typing.over + 0.25;
  const box = { y: h - 58, h: 40 } as const;
  const row = (i: number) => top + 46 + i * 40;
  const done = steps.at(-1)!.start;

  return (
    <Group offset={[at[0], at[1]]}>
      <Shape
        geometry={rect(w, h, { radius: 10 })}
        fill={theme.surface}
        stroke={{ color: theme.line, width: 1 }}
      />
      <Shape geometry={line([0, BAR], [w, BAR])} stroke={{ color: theme.line, width: 1 }} />
      <Text font={mono} size={14} at={[18, BAR / 2]} anchor="left" fill={theme.muted}>
        {title}
      </Text>

      {children}

      {/* The message, once it is sent. */}
      <Text
        font={mono}
        size={SIZE}
        at={[18, top]}
        anchor="baseline-left"
        fill={theme.muted}
        motion={appear(span(sent, 0.2))}
      >
        {`> ${prompt}`}
      </Text>

      {calls.map(({ tool, input, result }, i) => (
        <Group offset={[18, row(i)]} motion={appear(steps[i]!)}>
          <Shape geometry={circle(4)} at={[4, -5]} anchor="center" fill={theme.green} />
          <Text font={mono} size={SIZE} at={[18, 0]} anchor="baseline-left" fill={theme.text}>
            <Run>{tool}</Run>
            <Run fill={theme.muted}>{`(${input})`}</Run>
          </Text>
          <Group offset={[22, 20]} motion={appear(span(steps[i]!.start + 0.3, 0.2))}>
            <Shape
              geometry={hook}
              stroke={{ color: theme.faint, width: 1.4, cap: "round", join: "round" }}
            />
            <Text
              font={mono}
              size={SIZE - 1}
              at={[16, 0]}
              anchor="baseline-left"
              fill={theme.muted}
            >
              {result}
            </Text>
          </Group>
        </Group>
      ))}
      <Group offset={[18, row(calls.length)]} motion={appear(steps.at(-1)!)}>
        <Shape geometry={circle(4)} at={[4, -5]} anchor="center" fill={theme.text} />
        <Text font={mono} size={SIZE} at={[18, 0]} anchor="baseline-left" fill={theme.text}>
          {reply}
        </Text>
      </Group>

      {/* The spinner, while it works. */}
      <Group
        offset={[24, box.y - 18]}
        motion={[appear(span(sent + 0.1, 0.2)), exit(span(done, 0.2))]}
      >
        <Spinner />
        <Text font={mono} size={SIZE - 1} at={[16, 5]} anchor="baseline-left" fill={theme.clay}>
          Noodling…
        </Text>
      </Group>

      {/* The input box, where the prompt is typed and sent from. */}
      <Shape
        geometry={rect(w - 28, box.h, { radius: 8 })}
        at={[14, box.y]}
        stroke={{ color: theme.faint, width: 1 }}
      />
      <Text
        font={mono}
        size={SIZE}
        at={[28, box.y + box.h / 2 + 5]}
        anchor="baseline-left"
        fill={theme.muted}
      >
        {">"}
      </Text>
      <Text
        font={mono}
        size={SIZE}
        at={[46, box.y + box.h / 2 + 5]}
        anchor="baseline-left"
        fill={theme.text}
      >
        {typed(track("").to(prompt, typing).to("", span(sent, 0.05)), { by: words, caret: true })}
      </Text>
    </Group>
  );
};
