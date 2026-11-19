import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  line,
  pattern,
  radial,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import type { Scene } from "svjeez/tools";
import { geist, mono } from "../../../examples/fonts/faces";
import { theme } from "../../../examples/theme";
import { Bulb } from "./bulb";

export type Page = "home" | "lost";

const SIZE: Vec = [1200, 630];
const MARGIN = 80;
const HERO: Vec = [960, 270];
const TRACK_Y = 540;

const copy = {
  home: {
    title: "svjeez",
    lines: ["Write motion in TypeScript.", "Ship it as one SVG."],
    note: "zero-JS · CSS + SMIL · one file",
    mood: "happy",
  },
  lost: {
    title: "Page not found",
    lines: ["This frame is not on the timeline.", "Head back to svjeez."],
    note: "404 · svjeez",
    mood: "lost",
  },
} as const;

// Frame 0 is the finished card; the bulb only bobs on top of it.
const bob = span(0, 2);
const bobbing = track(0).to(-10, bob, ease.inOut).to(0, bob.next(2), ease.inOut).loop(4);

const dots = pattern({
  size: [24, 24],
  tile: (
    <Shape geometry={circle(1.2)} at={[12, 12]} anchor="center" fill={theme.border} opacity={0.3} />
  ),
});

const glow = radial.across({
  stops: [
    [0, "#FFC21A59"],
    [1, "#FFC21A00"],
  ],
});

const keyframes = [0, 0.25, 0.5, 0.75, 1] as const;

export const card = (page: Page): Scene => {
  const { title, lines, note, mood } = copy[page];

  return scene(
    {
      size: SIZE,
      duration: 4,
      title: page === "home" ? "svjeez" : "Page not found",
      desc: "svjeez link preview: a yellow light bulb mascot above a timeline.",
      theme,
      still: 0,
    },
    (canvas) => (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Shape geometry={canvas.rect} fill={dots} />

        <Shape geometry={circle(190)} at={HERO} anchor="center" fill={glow} />
        <Bulb
          mood={mood}
          size={230}
          at={HERO}
          motion={{ offset: bobbing.map((y): Vec => [0, y]) }}
        />

        <Group at={[MARGIN, TRACK_Y]}>
          <Shape
            geometry={line([0, 0], [canvas.width - 2 * MARGIN, 0])}
            stroke={{ color: theme.raised, width: 4, cap: "round" }}
          />
          {keyframes.map((at) => (
            <Shape
              key={`k${at}`}
              geometry={rect(14, 14, { radius: 3 })}
              at={[at * (canvas.width - 2 * MARGIN), 0]}
              anchor="center"
              rotate={45}
              fill={at === 0 ? theme.yellow : theme.border}
            />
          ))}
        </Group>

        <Align place="left" inset={MARGIN}>
          <Stack gap={28} align="start">
            <Text font={geist} weight={600} size={page === "home" ? 132 : 96} fill={theme.text}>
              {title}
            </Text>
            <Stack gap={8} align="start">
              {lines.map((text) => (
                <Text key={text} font={geist} size={40} fill={theme.muted}>
                  {text}
                </Text>
              ))}
            </Stack>
            <Text font={mono} size={22} fill={theme.border}>
              {note}
            </Text>
          </Stack>
        </Align>
      </Group>
    ),
  );
};
