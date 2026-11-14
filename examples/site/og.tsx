import { google } from "@svjeez/fonts";
import {
  Glyphs,
  Ink,
  Pivot,
  def,
  motion,
  render,
  strokeFont,
  tool,
  type Child,
  type Color,
} from "svjeez";
import { systemLight } from "svjeez";
import { mono } from "../style";
import { CHICK, GROUND, chick } from "./lib/chick";

// Link-preview cards for the site, one per page, each starring the chick doing that page's job. Every card is a still
// svjeez scene at 1200 by 630 in the site's default palette: a white background, the title in big type on the left, a hand-lettered aside, and
// the chick in its little set piece on the right.

const W = 1200;
const H = 630;
const display = await google("Inter Tight", { weight: 800 });
const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
const pen = tool.pen({ size: 3.2, seed: 4 });

const PAPER: Color = systemLight.base00;
const INK: Color = systemLight.base05;
const SOFT: Color = systemLight.base04;
const CORAL: Color = systemLight.base09;

/** The chick standing with its feet at x, y, `size` times the favicon, posed by the given still motions. */
const Chick = ({
  x,
  y,
  size,
  rotate = 0,
  look = { x: 0, y: 0 },
}: {
  x: number;
  y: number;
  size: number;
  rotate?: number;
  look?: { x: number; y: number };
}) => (
  <g transform={`translate(${x} ${y}) scale(${size}) translate(${-GROUND.x} ${-GROUND.y})`}>
    <Pivot origin={GROUND} animation={motion({ rotate })}>
      {chick({ feet: {}, look: motion(look) })}
    </Pivot>
  </g>
);

/** Hand-lettered words, as ink strokes. */
const Hand = ({ text, x, y, size = 40 }: { text: string; x: number; y: number; size?: number }) => (
  <Ink d={casual.path(text, { size, x, y }).d} tool={pen} fill={CORAL} />
);

/** The title wrapped into lines that fit `width`, at the largest size that takes three lines at most. */
const wrap = (text: string, width: number) => {
  for (const size of [84, 76, 68, 60, 52]) {
    const lines: string[] = [];

    for (const word of text.split(" ")) {
      const last = lines.at(-1);
      if (last !== undefined && display.measure(`${last} ${word}`, size) <= width)
        lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }

    if (lines.length <= 3 && lines.every((line) => display.measure(line, size) <= width))
      return { lines, size };
  }

  return { lines: [text], size: 44 };
};

/** The title, centered on the card's height, under a small mark. */
const Title = ({ title, width = 640 }: { title: string; width?: number }) => {
  const { lines, size } = wrap(title, width);
  const top = (H - lines.length * size * 1.05) / 2 + size * 0.8;

  return (
    <>
      {lines.map((text, i) => (
        <Glyphs
          font={display}
          text={text}
          size={size}
          x={88}
          y={top + i * size * 1.05}
          fill={INK}
        />
      ))}
    </>
  );
};

export type Mood = "home" | "intro" | "examples" | "play" | "lost";

/** Each page's title, and the one small thing the chick has with it. */
const SCENES: Record<Mood, { title: string; art: () => Child }> = {
  home: {
    title: "Animated SVGs from TypeScript.",
    art: () => <Chick x={940} y={460} size={1.9} look={{ x: -4, y: 2 }} />,
  },
  intro: {
    title: "The one-minute intro.",
    art: () => (
      <>
        <Chick x={900} y={460} size={1.7} look={{ x: 6, y: -2 }} />
        <path d="M1046 250L1100 284L1046 318Z" fill={CORAL} />
      </>
    ),
  },
  examples: {
    title: "Examples.",
    art: () => <Chick x={940} y={460} size={1.9} rotate={-6} look={{ x: -6, y: -3 }} />,
  },
  play: {
    title: "Play with svjeez.",
    art: () => (
      <>
        <Chick x={920} y={460} size={1.8} rotate={6} look={{ x: 6, y: 4 }} />
      </>
    ),
  },
  lost: {
    title: "Page not found.",
    art: () => (
      <>
        <Chick x={920} y={460} size={1.8} rotate={10} look={{ x: -5, y: -6 }} />
        <Hand text="?" x={1040} y={270} size={110} />
      </>
    ),
  },
};

const frame = (title: string, art: Child, width?: number) =>
  render(
    { width: W, height: H, duration: 1, title, reducedMotion: false },
    <>
      <rect width={W} height={H} fill={PAPER} />
      <Title title={title} width={width} />
      {art}
      <text x={88} y={H - 64} fontFamily={mono} fontSize={20} fill={SOFT}>
        svjeez
      </text>
    </>,
  );

/** The card for one of the site's pages. */
export const card = (mood: Mood): string => frame(SCENES[mood].title, SCENES[mood].art());

/** The card for an example: its picture, with the chick perched on top. */
export const exampleCard = (title: string, png: string, ratio: number): string => {
  const w = 420;
  const h = Math.min(340, w / ratio);
  const top = (H - h) / 2 + 30;

  return frame(
    title,
    <>
      <g clipPath={def.clipPath({}, <rect x={720} y={top} width={w} height={h} rx={18} />)}>
        <image
          href={`data:image/png;base64,${png}`}
          x={720}
          y={top}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
      <rect
        x={720}
        y={top}
        width={w}
        height={h}
        rx={18}
        fill="none"
        stroke={systemLight.base02}
        strokeWidth={2}
      />
      <Chick x={1060} y={top + 4} size={0.7} look={{ x: -5, y: 4 }} />
    </>,
    560,
  );
};

export default () => card("home");
