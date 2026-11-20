import { Code } from "@svjeez/code";
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
  count,
  type SceneElement,
  type Vec,
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
const SOURCE = { x: 660, y: STAGE.y + 40, w: 500, h: 232, bar: 40 } as const;
const RESULT = { x: 660, y: STAGE.y + 288, w: 500, h: 172, bar: 40 } as const;

const typing = span(0.6, 1.3);

const steps = span(2.0, 0.25).cascade(COPY.calls.length + 1, 0.75);
const writing = span(steps[0]!.start + 0.1, 1.2);
const shipped = steps.at(-1)!.start;

const code = `const trip = (t: number, miss: boolean) =>
  track(client).to(cache, span(t, 0.25)).to(
    miss ? origin : client, span(t + 0.25, 0.4));

export default scene({ size: [480, 160] }, () => (
  <Group>{packets.map(({ t, miss }) => (
    <Shape geometry={dot} at={trip(t, miss)} />
  ))}</Group>
));`;

// The result: requests travel from the client to the cache as dots. A hit comes straight back; a miss goes on to the
// origin and back, slower. Every node and dot is the film's own, the way the agent's scene would be.
const LANE = 96;
const NODES = { client: 70, cache: 250, origin: 430 } as const;
const go = shipped + 0.25;
const misses = new Set([1, 4]);
const packets = Array.from({ length: 6 }, (_, i) => ({ at: go + i * 0.22, miss: misses.has(i) }));

const client: Vec = [NODES.client, LANE];
const cache: Vec = [NODES.cache, LANE];
const origin: Vec = [NODES.origin, LANE];

const routeOf = ({ at, miss }: { readonly at: number; readonly miss: boolean }) => {
  const there = track<Vec>(client).to(cache, span(at, 0.25), ease.inOut);

  return miss
    ? {
        path: there
          .to(origin, span(at + 0.25, 0.4), ease.inOut)
          .to(client, span(at + 0.7, 0.45), ease.inOut),
        end: at + 1.15,
      }
    : { path: there.to(client, span(at + 0.25, 0.2), ease.inOut), end: at + 0.45 };
};

const Node = ({ x, name }: { readonly x: number; readonly name: string }): SceneElement => (
  <Group offset={[x, LANE]}>
    <Shape
      geometry={rect(96, 40, { radius: 8 })}
      at={[0, 0]}
      anchor="center"
      fill={theme.background}
      stroke={{ color: theme.faint, width: 1 }}
    />
    <Text font={mono} size={14} at={[0, 0]} anchor="center" fill={theme.text}>
      {name}
    </Text>
  </Group>
);

const Result = (): SceneElement => (
  <Group>
    <Shape
      geometry={line([NODES.client, LANE], [NODES.origin, LANE])}
      stroke={{ color: theme.line, width: 1.5, dash: [4, 5] }}
    />
    {packets.map((packet) => {
      const { path, end } = routeOf(packet);

      return (
        <Shape
          geometry={circle(6)}
          at={path}
          anchor="center"
          fill={packet.miss ? theme.clay : theme.green}
          opacity={track(0).to(1, span(packet.at, 0.05)).to(0, span(end, 0.08))}
        />
      );
    })}
    <Node x={NODES.client} name="client" />
    <Node x={NODES.cache} name="cache" />
    <Node x={NODES.origin} name="origin" />
    <Text
      font={mono}
      size={13}
      at={[NODES.client - 48, 148]}
      anchor="baseline-left"
      fill={theme.muted}
    >
      {"hit "}
    </Text>
    <Text
      font={mono}
      size={13}
      at={[NODES.client - 14, 148]}
      anchor="baseline-left"
      fill={theme.green}
    >
      2 ms
    </Text>
    <Text
      font={mono}
      size={13}
      at={[NODES.client + 40, 148]}
      anchor="baseline-left"
      fill={theme.muted}
    >
      miss
    </Text>
    <Text
      font={mono}
      size={13}
      at={[NODES.client + 82, 148]}
      anchor="baseline-left"
      fill={theme.clay}
    >
      48 ms
    </Text>
    <Text
      font={mono}
      size={13}
      at={[NODES.origin + 48, 148]}
      anchor="baseline-right"
      fill={theme.muted}
    >
      {"hit rate "}
      {count(track(0).to(67, span(go, 1.6), ease.out))}%
    </Text>
  </Group>
);

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
            <Result />
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
