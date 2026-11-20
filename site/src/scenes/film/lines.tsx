import { Lettering, casual } from "@svjeez/fonts/handwriting";
import { Group, Run, Text, ease, enter, exit, span, type SceneElement } from "svjeez";
import { FILM_SIZE } from "./size";
import { SHOTS, STAGE, W, geist, theme } from "./kit";

const hand = await casual();

/** The handwritten line, across the whole stage. */
export const Anything = (): SceneElement => (
  <Group motion={exit(span(SHOTS.anything.over! - 0.35, 0.3))}>
    <Group offset={[STAGE.x, STAGE.y + STAGE.h / 2 + 30]}>
      <Lettering
        font={hand}
        text="anything you can describe"
        width={STAGE.w}
        y={0}
        from={0.2}
        size={96}
        speed={2600}
        ink={theme.text}
      />
    </Group>
  </Group>
);

const FACTS = [
  { lead: "0 bytes", rest: " of javascript" },
  { lead: "1 file", rest: `, ${FILM_SIZE} for all of this` },
  { lead: "plays in", rest: " an <img> tag" },
] as const;

/** Three plain facts, each a beat after the last. */
export const Facts = (): SceneElement => (
  <Group motion={exit(span(SHOTS.facts.over! - 0.35, 0.3))}>
    {FACTS.map(({ lead, rest }, i) => (
      <Text
        font={geist}
        weight={600}
        size={58}
        letterSpacing={-2.2}
        at={[W / 2, STAGE.y + 140 + i * 110]}
        anchor="baseline"
        fill={theme.text}
        motion={enter(span(0.2 + i * 0.6, 0.5), {
          from: { opacity: 0, offset: [0, 16] },
          curve: ease.out,
        })}
      >
        <Run>{lead}</Run>
        <Run fill={theme.muted}>{rest}</Run>
      </Text>
    ))}
  </Group>
);
