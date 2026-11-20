import { Icon } from "@svjeez/icons";
import { bolt, database, lock, stack2 } from "@svjeez/icons/tabler";
import {
  Arrow,
  Group,
  Stack,
  Text,
  ease,
  enter,
  ref,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Note } from "./note";
import { ACCENTS, Header, SHOTS, STAGE, geist, shown, spring, theme } from "./kit";

const CARD = { w: 210, h: 140, gap: 60 } as const;
const ROW = STAGE.x + (STAGE.w - 4 * CARD.w - 3 * CARD.gap) / 2;
const TOP = STAGE.y + (STAGE.h - CARD.h) / 2;

const cards = [
  { name: "Auth", icon: lock, lift: 0 },
  { name: "Edge", icon: bolt, lift: -70 },
  { name: "Queue", icon: stack2, lift: 56 },
  { name: "Store", icon: database, lift: -24 },
].map((card, i) => ({
  ...card,
  handle: ref(),
  color: ACCENTS[i]!,
  x: ROW + i * (CARD.w + CARD.gap),
}));

const pops = span(0.5, 0.5).cascade(4, 0.14);
const drawn = span(1.3, 0.5).cascade(3, 0.12);

/** One spring takes the cards off the line and back. Every card is a map of it, so the arrows between them, which
 * follow two cards at once, key at the same moments. */
const bounce = track(0)
  .to(1, span(2.4, spring.settle), spring)
  .to(0, span(4.2, spring.settle), spring);

const moved = (x: number, lift: number) => bounce.map((v): Vec => [x, TOP + lift * v]);

/** Shot 2: four cards draw in, spring off the line and back, and the arrows between them hold on to their edges. */
export const Layout = (): SceneElement => {
  const { over } = SHOTS.layout;

  return (
    <Group>
      <Header
        title="Springs, and arrows that follow."
        from="track() · ref() · @svjeez/icons"
        over={over!}
      />
      <Group motion={shown(over!, 0)}>
        {cards.map(({ name, icon, lift, handle, color, x }, i) => (
          <Stack
            ref={handle}
            at={moved(x, lift)}
            width={CARD.w}
            height={CARD.h}
            gap={14}
            align="center"
            justify="center"
            radius={10}
            fill={theme.background}
            stroke={{ color: theme.strong, width: 1 }}
            motion={enter(pops[i]!, { from: { opacity: 0, scale: 0.6 }, curve: ease.pop })}
          >
            <Icon
              icon={icon}
              size={40}
              color={color}
              stroke={{ width: 1.5 }}
              draw={(piece) => track(0).to(1, span(pops[i]!.start + 0.2 + piece * 0.15, 0.5))}
            />
            <Text font={geist} weight={600} size={24} letterSpacing={-0.5} fill={theme.text}>
              {name}
            </Text>
          </Stack>
        ))}
        <Note text="boing!" at={[cards[1]!.x + CARD.w / 2, STAGE.y + 70]} from={2.45} tilt={-8} />
        {cards.slice(1).map(({ handle }, i) => (
          <Arrow
            from={cards[i]!.handle.right}
            to={handle.left}
            inset={8}
            head={7}
            stroke={{ color: theme.faint, width: 1.5, cap: "round" }}
            draw={track(0).to(1, drawn[i]!, ease.out)}
          />
        ))}
      </Group>
    </Group>
  );
};
