import { Group, Shape, Text, rect, span, type SceneElement } from "svjeez";
import { Session, Spinner, type Call } from "./session";
import { SHOTS, STAGE, geist, mono, shown, theme } from "./kit";

// The agent slide: a coding agent's session fills the stage. It is asked for an animated graphic, reads the svjeez
// skill, writes the scene, checks it, renders frames and looks at them, and says what it made.

const PROMPT = "animate our cache hit/miss flow for the readme";

const CALLS: readonly Call[] = [
  { tool: "Read", input: "skills/svjeez/SKILL.md", result: "read 299 lines" },
  { tool: "Write", input: "docs/cache-flow.tsx", result: "wrote 31 lines" },
  { tool: "Bash", input: "svjeez check docs/cache-flow.tsx", result: "0 issues" },
  {
    tool: "Bash",
    input: "svjeez frames docs/cache-flow.tsx --sheet",
    result: "6 frames and sheet.png",
  },
  { tool: "Read", input: "frames/sheet.png", result: "the miss path reads clearly; leaving it" },
];

const REPLY = "wrote docs/cache-flow.svg (18 KB) and linked it in the readme";

const SIZE = [STAGE.w - 60, STAGE.h - 24] as const;
const typing = span(0.9, 1.1);
const steps = span(2.6, 0.25).cascade(CALLS.length + 1, 0.95);

/** The card a session opens with. */
const Welcome = (): SceneElement => (
  <Group offset={[18, 54]}>
    <Shape geometry={rect(420, 64, { radius: 8 })} stroke={{ color: theme.clay, width: 1.2 }} />
    <Group offset={[22, 24]}>
      <Spinner />
    </Group>
    <Text
      font={geist}
      weight={600}
      size={17}
      at={[40, 29]}
      anchor="baseline-left"
      fill={theme.text}
    >
      Welcome back
    </Text>
    <Text font={mono} size={14} at={[22, 50]} anchor="baseline-left" fill={theme.muted}>
      cwd: ~/acme/cache
    </Text>
  </Group>
);

export const ClaudeSlide = (): SceneElement => (
  <Group motion={shown(SHOTS.claude.over!, 0.1)}>
    <Session
      at={[STAGE.x + 30, STAGE.y + 12]}
      size={SIZE}
      title="~/acme/cache"
      prompt={PROMPT}
      calls={CALLS}
      reply={REPLY}
      typing={typing}
      steps={steps}
      top={146}
    >
      <Welcome />
    </Session>
  </Group>
);

export const CLAUDE = { steps, over: SHOTS.claude.over! } as const;
