import { Group, Run, Stack, Text, ease, enter, exit, span, type SceneElement } from "svjeez";
import { ACCENTS, H, STAGE, W, geist, mono, theme } from "./kit";

/** The tag the film lives in, each part in one of the four colors. */
export const Tag = ({ size }: { readonly size: number }): SceneElement => (
  <Text font={mono} size={size} fill={theme.text}>
    <Run fill={ACCENTS[0]}>{"<img"}</Run>
    <Run fill={ACCENTS[1]}>{" src="}</Run>
    <Run fill={ACCENTS[2]}>{'"film.svg"'}</Run>
    <Run fill={ACCENTS[3]}>{" />"}</Run>
  </Text>
);

/** Shot 1, five seconds: the tag sits alone, opens into the stage, and the stage says what you are watching. */
export const Open = (): SceneElement => (
  <Group>
    <Group
      at={[W / 2, H / 2]}
      anchor="center"
      motion={[
        enter(span(0.2, 0.6), { from: { opacity: 0, scale: 0.94 }, curve: ease.out }),
        exit(span(1.4, 0.45), { to: { opacity: 0, scale: 1.25 }, curve: ease.in }),
      ]}
    >
      <Tag size={48} />
    </Group>
    <Stack
      gap={14}
      align="center"
      at={[W / 2, STAGE.y + STAGE.h / 2]}
      anchor="center"
      motion={[
        enter(span(2.5, 0.6), { from: { opacity: 0, offset: [0, 18] }, curve: ease.out }),
        exit(span(4.55, 0.4), { to: { opacity: 0, offset: [0, -18] }, curve: ease.in }),
      ]}
    >
      <Text font={geist} weight={600} size={76} letterSpacing={-3.4} fill={theme.text}>
        this whole film is one svg
      </Text>
      <Text
        font={geist}
        size={30}
        letterSpacing={-0.4}
        fill={theme.muted}
        motion={enter(span(2.75, 0.6), { from: { opacity: 0, offset: [0, 12] }, curve: ease.out })}
      >
        compiled from tsx, zero js inside
      </Text>
    </Stack>
  </Group>
);
