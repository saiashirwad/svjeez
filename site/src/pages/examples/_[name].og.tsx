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

// Each example's card is its name on the left and the example itself on the right: a window, taken at its moment (its
// poster's, unless it sets one), lifted off a panel of the example's own color. The color comes from the example's
// name, so it stays with the example wherever it moves in the gallery.
const hash = (name: string) =>
  [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

export default (async ({ params }) => {
  const { name, scene, moment } = example(params.name!);
  const { title, width, height } = scene;
  const accent = accents[hash(name) % accents.length]!;
  const WIDTH = Math.min(MAX_W, Math.round(((MAX_H - BAR) * width) / height));
  const h = Math.round((WIDTH * height) / width) + BAR;

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
      {/* Blip sits on the window's top edge, feet over the side, leaning in to watch the example. */}
      <Mascot
        at={[HERO[0] + WIDTH / 2 - 70, HERO[1] - h / 2 + 4]}
        size={110}
        pose={{
          tilt: -8,
          stretch: [1.08, 0.92],
          look: [-5, 5],
          feet: { left: [-4, 6], right: [6, 8], kick: 12 },
        }}
      />
      <Align place="left" inset={80}>
        {/* Just the example's name: the picture says the rest. */}
        <Copy title={name} titleSize={80} width={500} note="svjeez example" />
      </Align>
    </Group>
  ));
}) satisfies OgCard;
