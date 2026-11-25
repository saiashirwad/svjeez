import type { OgCard } from "@svjeez/astro/og";
import { ogScene } from "@svjeez/og";
import { Picture, Group, Shape, picture, rect, shadow } from "svjeez";
import { theme } from "@examples/theme";
import { Align } from "svjeez";
import { Backdrop, Copy, Mascot } from "../../og/kit";
import { renderStill } from "@svjeez/og/render";
import { example } from "../../examples";
import { windowed } from "../../window";

/** The panel the example sits on: the card's right half, edge to edge. */
const PANEL = { x: 600, w: 600 } as const;

/** The window's widest and tallest: a wide scene takes the full width, a tall or square one the full height. */
const [MAX_W, MAX_H, BAR] = [470, 420, 40];
const HERO = [PANEL.x + PANEL.w / 2, 335] as const;
const accents = [theme.blue, theme.magenta, theme.green, theme.orange, theme.cyan, theme.red];

const hash = (name: string) =>
  [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

/** A random number generator seeded by `seed` (mulberry32): the same seed always gives the same numbers. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Where on the window's top edge Blip sits, and how, picked at random from the example's name, so every card has its
 * own and a card is the same on every build. Blip keeps clear of the traffic lights and the file name in the bar.
 */
const perch = (name: string, left: number, width: number) => {
  const random = seeded(hash(name));
  const between = (a: number, b: number) => a + random() * (b - a);
  const middle = left + width / 2;
  const label = (name.length + 4) * 4 + 50;

  const spots = [
    [left + 120, middle - label],
    [middle + label, left + width - 40],
  ].filter(([a, b]) => b! > a!);

  const [a, b] = spots[Math.floor(random() * spots.length)]!;
  const x = between(a!, b!);
  const toward = x < middle ? 1 : -1;
  const flip = random() < 0.5;

  return {
    x,
    size: between(96, 124),
    pose: {
      tilt: between(-6, 14) * toward,
      stretch: [between(1, 1.12), between(0.9, 1)] as const,
      look: [between(3, 6) * toward * (flip ? -1 : 1), between(3, 6)] as const,
      lit: random() < 0.3,
      flip,
      feet: {
        left: [between(-6, 0), between(4, 8)],
        right: [between(0, 8), between(4, 10)],
        kick: between(-10, 20),
      },
    } as const,
  };
};

export default (async ({ params }) => {
  const { name, scene, moment } = example(params.name!);
  const { title, width, height } = scene;
  const accent = accents[hash(name) % accents.length]!;
  const WIDTH = Math.min(MAX_W, Math.round(((MAX_H - BAR) * width) / height));
  const h = Math.round((WIDTH * height) / width) + BAR;
  const blip = perch(name, HERO[0] - WIDTH / 2, WIDTH);

  const art = picture(
    await renderStill(windowed(scene, { size: [WIDTH, h], title: `${name}.tsx` }), {
      time: moment,
    }),
  );

  return ogScene({ theme, title, desc: `The ${name} example, in a window.` }, () => (
    <Group>
      <Backdrop />
      <Shape geometry={rect(PANEL.w, 630)} at={[PANEL.x, 0]} fill={accent} opacity={0.14} />
      <Shape
        geometry={rect(WIDTH, h, { radius: 12 })}
        at={HERO}
        anchor="center"
        fill={theme.background}
        effects={[shadow({ color: "#000000", offset: [0, 18], blur: 40, opacity: 0.16 })]}
      />
      <Picture src={art} width={WIDTH} at={HERO} anchor="center" />
      <Mascot at={[blip.x, HERO[1] - h / 2 + 4]} size={blip.size} pose={blip.pose} />
      <Align place="left" inset={80}>
        <Copy title={name} titleSize={80} width={500} note="svjeez example" />
      </Align>
    </Group>
  ));
}) satisfies OgCard;
