import { Group, Run, Stack, Text, ease, enter, span, type SceneElement } from "svjeez";
import { Tag } from "./open";
import { W, geist, mono, theme } from "./kit";

/** Where the stage lands as a pill at the end, in the film's pixels. */
export const PILL = { x: W / 2, y: 112, w: 440, h: 64 } as const;

const rise = (at: number) =>
  enter(span(at, 0.5), { from: { opacity: 0, offset: [0, 14] }, curve: ease.out });

const Chip = ({
  label,
  command,
}: {
  readonly label: string;
  readonly command: string;
}): SceneElement => (
  <Stack
    gap={12}
    padding={[24, 18]}
    radius={6}
    fill={theme.background}
    stroke={{ color: theme.line, width: 1 }}
  >
    <Text font={mono} size={13} letterSpacing={1.2} fill={theme.muted}>
      {label.toUpperCase()}
    </Text>
    <Text font={mono} size={22} fill={theme.text}>
      <Run fill={theme.muted}>{"$ "}</Run>
      {command}
    </Text>
  </Stack>
);

/** Shot 8, five and a half seconds: the stage has folded back into the tag; the name and how to get it come in under it. */
export const Close = (): SceneElement => (
  <Group>
    <Group at={[PILL.x, PILL.y]} anchor="center" motion={rise(1.3)}>
      <Tag size={26} />
    </Group>
    <Stack gap={52} align="center" at={[W / 2, 180]} anchor="top">
      <Stack gap={26} align="center">
        <Stack gap={4} align="center">
          <Text
            font={geist}
            weight={600}
            size={112}
            letterSpacing={-5.6}
            fill={theme.text}
            motion={rise(2)}
          >
            svjeez
          </Text>
          <Text font={geist} size={34} letterSpacing={-0.8} fill={theme.muted} motion={rise(2.15)}>
            animated svgs your agent can write
          </Text>
        </Stack>
        <Text font={mono} size={17} fill={theme.muted} motion={rise(2.3)}>
          {"tsx → one .svg · zero js · works in <img>"}
        </Text>
      </Stack>
      <Stack direction="row" gap={16} motion={rise(2.45)}>
        <Chip label="for your repo" command="npm i svjeez" />
        <Chip label="for your agent" command="npx svjeez skill --install" />
      </Stack>
    </Stack>
  </Group>
);
