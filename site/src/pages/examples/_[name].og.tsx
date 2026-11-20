import type { OgCard } from "@svjeez/astro/og";
import { ogScene } from "@svjeez/og";
import { Picture, Group, Shape, picture, rect } from "svjeez";
import { theme } from "@examples/theme";
import { Align } from "svjeez";
import { Backdrop, Copy, Timeline } from "../../og/kit";
import { renderStill } from "@svjeez/og/render";
import { example } from "../../examples";
import { windowed } from "../../window";

const WIDTH = 440;
const HERO = [920, 270] as const;
const accents = [theme.blue, theme.magenta, theme.green, theme.orange, theme.cyan, theme.red];

// A card has room for about three lines of the description.
const brief = (text: string, max = 100) => {
  if (text.length <= max) return text;

  return `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,:;]$/, "")}…`;
};

// Each example's card shows the example itself in a window, taken at the moment its poster shows, on a tilted card of
// the example's own color. The color comes from the example's name, so it stays with the example wherever it moves in
// the gallery, and it lights the timeline too.
const hash = (name: string) =>
  [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

export default (async ({ params }) => {
  const { name, scene } = example(params.name!);
  const { title, desc, width, height } = scene;
  const accent = accents[hash(name) % accents.length]!;
  const h = Math.round((WIDTH * height) / width) + 40;

  const art = picture(
    await renderStill(windowed(scene, { size: [WIDTH, h], title: `${name}.tsx` })),
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
      <Timeline accent={accent} active={hash(name) % 5} />
      <Align place="left" inset={80}>
        <Copy
          title={title}
          titleSize={64}
          text={brief(desc)}
          textSize={32}
          note={`examples/${name}  ·  ${width}×${height}`}
        />
      </Align>
    </Group>
  ));
}) satisfies OgCard;
