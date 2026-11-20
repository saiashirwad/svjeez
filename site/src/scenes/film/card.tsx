import { Icon, type IconData } from "@svjeez/icons";
import { brandReact, brandSvelte } from "@svjeez/icons/tabler";
import { Group, Stack, Text, ease, enter, span, track, type SceneElement } from "svjeez";
import { SHOTS, STAGE, W, geist, shown, theme } from "./kit";

// One sentence on its own, in capitals, between writing scenes and filming apps: the frameworks it films are named
// with their logos beside them, each logo drawing itself as its line comes in.

const SIZE = 46;

const LOGOS = {
  react: { icon: brandReact, color: "#149ECA" },
  svelte: { icon: brandSvelte, color: "#FF3E00" },
} as const satisfies Record<string, { readonly icon: IconData; readonly color: string }>;

type Piece = string | keyof typeof LOGOS;

/** The sentence, a line at a time: words, and the logos that sit after the frameworks they name. */
const LINES: readonly (readonly Piece[])[] = [
  ["RECORD REAL REACT", "react", "AND SVELTE", "svelte"],
  ["COMPONENTS AS ANIMATED SVG — MORE SOON."],
];

const isLogo = (piece: Piece): piece is keyof typeof LOGOS => piece in LOGOS;

const lineAt = (i: number) => 0.2 + i * 0.35;

export const FilmCard = (): SceneElement => (
  <Group motion={shown(SHOTS.card.over!, 0)}>
    <Stack gap={14} align="center" at={[W / 2, STAGE.y + STAGE.h / 2]} anchor="center">
      {LINES.map((pieces, i) => (
        <Stack
          direction="row"
          gap={18}
          align="center"
          motion={enter(span(lineAt(i), 0.5), {
            from: { opacity: 0, offset: [0, 14] },
            curve: ease.out,
          })}
        >
          {pieces.map((piece) =>
            isLogo(piece) ? (
              <Icon
                icon={LOGOS[piece].icon}
                size={SIZE * 0.95}
                color={LOGOS[piece].color}
                stroke={{ width: 1.8 }}
                draw={(part) => track(0).to(1, span(lineAt(i) + 0.3 + part * 0.08, 0.6))}
              />
            ) : (
              <Text font={geist} weight={600} size={SIZE} letterSpacing={-1.4} fill={theme.text}>
                {piece}
              </Text>
            ),
          )}
        </Stack>
      ))}
    </Stack>
  </Group>
);
