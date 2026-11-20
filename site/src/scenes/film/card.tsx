import { Lettering, casual, handwrite } from "@svjeez/fonts/handwriting";
import { Icon, type IconData } from "@svjeez/icons";
import { brandReact, brandSvelte } from "@svjeez/icons/tabler";
import {
  Group,
  Stack,
  Text,
  ease,
  enter,
  span,
  track,
  type SceneElement,
  type Track,
  type Vec,
} from "svjeez";
import { SHOTS, STAGE, W, geist, mono, shown, theme } from "./kit";

// One sentence on its own, in capitals, between writing scenes and filming apps. The frameworks it films are named
// with their logos beside them; each logo draws itself, then keeps moving a little. "more soon" is jotted under it.

const hand = await casual();

const SIZE = 76;
const LOGO = SIZE * 1.05;

/** How each logo keeps moving once drawn: React's atom turns, Svelte's mark rocks. */
const LOGOS = {
  react: {
    icon: brandReact,
    color: "#149ECA",
    turn: (from: number) => track(0).to(120, span(from, 2.6), ease.linear),
  },
  svelte: {
    icon: brandSvelte,
    color: "#FF3E00",
    turn: (from: number) =>
      track(0)
        .to(-9, span(from, 0.45), ease.inOut)
        .to(7, span(from + 0.45, 0.6), ease.inOut)
        .to(-4, span(from + 1.05, 0.6), ease.inOut)
        .to(0, span(from + 1.65, 0.5), ease.inOut),
  },
} as const satisfies Record<
  string,
  {
    readonly icon: IconData;
    readonly color: string;
    readonly turn: (from: number) => Track<number>;
  }
>;

type Piece = string | keyof typeof LOGOS;

/** The sentence, a line at a time: words, and the logos that sit after the frameworks they name. */
const LINES: readonly (readonly Piece[])[] = [
  ["RECORD REAL REACT", "react"],
  ["AND SVELTE", "svelte", "COMPONENTS"],
  ["AS ANIMATED SVG"],
];

const isLogo = (piece: Piece): piece is keyof typeof LOGOS => piece in LOGOS;

const lineAt = (i: number) => 0.15 + i * 0.25;
/** Each line's box is the font's ascent and descent tall (Geist's, which Geist Mono shares); the lines sit a little
 * apart, and the block is centered. */
const { ascent, descent } = mono.metrics;

const LINE = (ascent + descent) * SIZE;
const GAP = 6;
const PITCH = LINE + GAP;
const SOON_BELOW = 84;
const BLOCK = LINES.length * PITCH - GAP + SOON_BELOW;
const TOP = STAGE.y + (STAGE.h - BLOCK) / 2;

const SOON = { text: "more soon", size: 70, at: lineAt(LINES.length) + 0.5 } as const;
const soonEnd = handwrite(hand, SOON.text, {
  width: STAGE.w,
  y: 0,
  from: SOON.at,
  size: SOON.size,
  speed: 1600,
}).end;

/** Where "more soon" ends, so Blip can stand beside it. */
export const SOON_END: Vec = [W / 2 + 200, TOP + LINES.length * PITCH - GAP + SOON_BELOW + 6];

export const FilmCard = (): SceneElement => (
  <Group motion={shown(SHOTS.card.over!, 0)}>
    <Stack gap={GAP} align="center" at={[W / 2, TOP]} anchor="top">
      {LINES.map((pieces, i) => (
        <Stack
          direction="row"
          gap={22}
          align="center"
          motion={enter(span(lineAt(i), 0.5), {
            from: { opacity: 0, offset: [0, 18] },
            curve: ease.out,
          })}
        >
          {pieces.map((piece) => {
            if (!isLogo(piece))
              return (
                <Text font={geist} weight={600} size={SIZE} letterSpacing={-2.4} fill={theme.text}>
                  {piece}
                </Text>
              );

            const { icon, color, turn } = LOGOS[piece];
            const drawn = lineAt(i) + 0.3;

            return (
              <Group origin="center" motion={{ rotate: turn(drawn + 0.7) }}>
                <Icon
                  icon={icon}
                  size={LOGO}
                  color={color}
                  stroke={{ width: 1.7 }}
                  draw={(part) => track(0).to(1, span(drawn + part * 0.08, 0.6))}
                />
              </Group>
            );
          })}
        </Stack>
      ))}
    </Stack>
    <Group offset={[STAGE.x, TOP + LINES.length * PITCH - GAP + SOON_BELOW]}>
      <Lettering
        font={hand}
        text={SOON.text}
        width={STAGE.w}
        y={0}
        from={SOON.at}
        size={SOON.size}
        speed={1600}
        ink={theme.clay}
      />
    </Group>
  </Group>
);

export const CARD_TIMES = { soonEnd } as const;
