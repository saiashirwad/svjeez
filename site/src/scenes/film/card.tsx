import { Group, Stack, Text, ease, enter, span, type SceneElement } from "svjeez";
import { SHOTS, STAGE, W, geist, shown, theme } from "./kit";

// A line on its own, between writing scenes and filming apps.

export const FilmCard = (): SceneElement => (
  <Group motion={shown(SHOTS.card.over!, 0)}>
    <Stack gap={18} align="center" at={[W / 2, STAGE.y + STAGE.h / 2]} anchor="center">
      <Text font={geist} weight={600} size={72} letterSpacing={-3.2} fill={theme.text}>
        already built it? film it.
      </Text>
      <Text
        font={geist}
        size={28}
        letterSpacing={-0.4}
        fill={theme.muted}
        motion={enter(span(0.7, 0.5), { from: { opacity: 0, offset: [0, 10] }, curve: ease.out })}
      >
        svjeez can record a running app, components and all, into the same kind of svg.
      </Text>
    </Stack>
  </Group>
);
