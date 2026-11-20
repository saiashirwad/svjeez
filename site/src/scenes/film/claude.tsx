import { Group, Shape, Text, rect, span, type SceneElement } from "svjeez";
import { BLIP } from "../blip";
import { Session, type Call } from "./session";
import { SHOTS, STAGE, mono, shown, theme } from "./kit";

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

const SIZE = [STAGE.w - 60, STAGE.h] as const;
const typing = span(0.9, 1.1);
const steps = span(2.6, 0.25).cascade(CALLS.length + 1, 0.95);

/** Blip in pixels, for the session's header: a row per line, a letter per pixel. */
const SPRITE = [
  "     yy     ",
  "      s     ",
  "   yyyyyy   ",
  "  yyyyyyyy  ",
  " yyeyyyyeyy ",
  " yyyyyyyyyy ",
  " yyyyyyyyyy ",
  " bbbbbbbbbb ",
  "  f      f  ",
];

const PIXEL = 5;
const INK: Readonly<Record<string, string>> = {
  y: BLIP.yellow,
  s: BLIP.stem,
  e: BLIP.ink,
  b: BLIP.belly,
  f: BLIP.foot,
};

const Sprite = (): SceneElement => (
  <Group>
    {SPRITE.flatMap((row, y) =>
      [...row].flatMap((pixel, x) =>
        pixel === " "
          ? []
          : [
              <Shape
                geometry={rect(PIXEL, PIXEL)}
                at={[x * PIXEL, y * PIXEL]}
                fill={INK[pixel] ?? BLIP.yellow}
              />,
            ],
      ),
    )}
  </Group>
);

/** What a session opens with: who, which model, and where. */
const Banner = (): SceneElement => (
  <Group offset={[24, 56]}>
    <Sprite />
    <Group offset={[84, 14]}>
      <Text font={mono} size={16} at={[0, 0]} anchor="baseline-left" fill={theme.text}>
        Claude Code
      </Text>
      <Text font={mono} size={15} at={[0, 21]} anchor="baseline-left" fill={theme.muted}>
        Opus 5.5 · Claude Max
      </Text>
      <Text font={mono} size={15} at={[0, 42]} anchor="baseline-left" fill={theme.muted}>
        ~/acme/cache
      </Text>
    </Group>
  </Group>
);

export const ClaudeSlide = (): SceneElement => (
  <Group motion={shown(SHOTS.claude.over!, 0.1)}>
    <Session
      at={[STAGE.x + 30, STAGE.y]}
      size={SIZE}
      title="claude"
      prompt={PROMPT}
      calls={CALLS}
      reply={REPLY}
      typing={typing}
      steps={steps}
      top={140}
      placeholder="explain this codebase"
    >
      <Banner />
    </Session>
  </Group>
);

export const CLAUDE = { steps, over: SHOTS.claude.over! } as const;
