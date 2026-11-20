import type { OgCard } from "@svjeez/astro/og";
import { ogScene } from "@svjeez/og";
import { Picture, Group, Shape, picture, rect } from "svjeez";
import { theme } from "@examples/theme";
import { Align } from "svjeez";
import { Backdrop, Copy, Mascot, Timeline } from "../../og/kit";
import { renderStill } from "@svjeez/og/render";
import { example } from "../../examples";
import { windowed } from "../../window";

/** The window's widest and tallest: a wide scene takes the full width, a tall or square one the full height. */
const [MAX_W, MAX_H, BAR] = [440, 330, 40];
const HERO = [920, 270] as const;
const accents = [theme.blue, theme.magenta, theme.green, theme.orange, theme.cyan, theme.red];

// Each example's card shows the example itself in a window, taken at its moment (its poster's, unless it sets one), on a tilted card of
// the example's own color. The color comes from the example's name, so it stays with the example wherever it moves in
// the gallery, and it lights the timeline too.
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
      <Shape
        geometry={rect(WIDTH + 40, h + 40, { radius: 22 })}
        at={HERO}
        anchor="center"
        origin="center"
        rotate={4}
        fill={accent}
        opacity={0.18}
      />
      <Shape
        geometry={rect(WIDTH + 40, h + 40, { radius: 22 })}
        at={HERO}
        anchor="center"
        origin="center"
        rotate={-3}
        fill={accent}
        opacity={0.12}
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
      <Timeline accent={accent} active={hash(name) % 5} />
      <Align place="left" inset={80}>
        {/* Just the example's name: the picture says the rest. */}
        <Copy title={name} titleSize={96} note="svjeez example" />
      </Align>
    </Group>
  ));
}) satisfies OgCard;
