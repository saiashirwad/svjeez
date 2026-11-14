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
const YELLOW: Color = CHICK.yellow;

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

/** A hand-lettered note in coral ink. */
const Hand = ({ text, x, y, size = 38 }: { text: string; x: number; y: number; size?: number }) => (
  <Ink d={casual.path(text, { size, x, y }).d} tool={pen} fill={CORAL} />
);

/** A loose hand-drawn arrow from one point to another, bowing to one side. */
const Arrow = ({
  from,
  to,
  bow = 40,
}: {
  from: [number, number];
  to: [number, number];
  bow?: number;
}) => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2 - ((y2 - y1) / Math.hypot(x2 - x1, y2 - y1)) * bow;
  const my = (y1 + y2) / 2 + ((x2 - x1) / Math.hypot(x2 - x1, y2 - y1)) * bow;
  const a = Math.atan2(y2 - my, x2 - mx);

  const head = (turn: number) =>
    `M${x2} ${y2}L${x2 - 16 * Math.cos(a + turn)} ${y2 - 16 * Math.sin(a + turn)}`;

  return (
    <path
      d={`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}${head(0.5)}${head(-0.5)}`}
      fill="none"
      stroke={CORAL}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

/** A fat yellow highlighter swipe behind a stretch of text. */
const Swipe = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <path
    d={`M${x - 10} ${y + 6}L${x + w + 12} ${y - 4}L${x + w + 6} ${y + h - 2}L${x - 6} ${y + h + 4}Z`}
    fill={YELLOW}
    opacity={0.55}
  />
);

const X = 80;
const LEAD = 0.96;

/**
 * Big tight lines of the title, as large as fits up to `max` and centered on the card (moved down by `nudge`), with the chick standing in for the full stop at the end of the last
 * line. Returns the drawing and where that chick stands, so a card can hang a note on it.
 */
const set = (
  lines: string[],
  max: number,
  nudge: number,
  pose: { rotate?: number; look?: { x: number; y: number } } = {},
  highlight?: { line: number; from: string; word: string },
) => {
  const last = lines.length - 1;

  // The last line carries the chick, about one em wide with its gap.
  const widest = (size: number) =>
    Math.max(
      ...lines.map((line, i) => display.measure(line, size) + (i === last ? size * 0.98 : 0)),
    );

  let size = max;

  while (widest(size) > W - 2 * X) size -= 2;

  // From the cap height of the first line down to the baseline of the last.
  const block = size * 0.72 + last * size * LEAD;
  const top = (H - block) / 2 + nudge;
  const base = (i: number) => top + size * 0.72 + i * size * LEAD;
  const end = X + display.measure(lines[last]!, size) + size * 0.56;
  const scale = size / 150;

  const swipe =
    highlight &&
    (() => {
      const x = X + display.measure(highlight.from, size);

      return (
        <Swipe
          x={x}
          y={base(highlight.line) - size * 0.52}
          w={display.measure(highlight.word, size)}
          h={size * 0.5}
        />
      );
    })();

  return {
    // Where the chick's antenna tops out, for an arrow to point at.
    top,
    chick: { x: end, y: base(last), head: base(last) - size * 0.95 },
    scale,
    draw: (
      <>
        {swipe}
        {lines.map((text, i) => (
          <Glyphs font={display} text={text} size={size} x={X} y={base(i)} fill={INK} />
        ))}
        <Chick
          x={end}
          y={base(last) + size * 0.02}
          size={scale}
          rotate={pose.rotate}
          look={pose.look}
        />
      </>
    ),
  };
};

const frame = (title: string, ...art: Child[]) =>
  render(
    { width: W, height: H, duration: 1, title, reducedMotion: false },
    <>
      <rect width={W} height={H} fill={PAPER} />
      {art}
      <text x={X} y={H - 56} fontFamily={mono} fontSize={20} fill={SOFT}>
        svjeez.texoport.in
      </text>
    </>,
  );

export type Mood = "home" | "intro" | "examples" | "play" | "lost";

const CARDS: Record<Mood, () => string> = {
  home: () => {
    const t = set(
      ["Animated SVGs", "from TypeScript"],
      128,
      30,
      { look: { x: -3, y: 3 } },
      { line: 1, from: "from ", word: "TypeScript" },
    );

    return frame(
      "svjeez",
      t.draw,
      <Hand text="that's one <img>!" x={t.chick.x - 330} y={t.top - 40} />,
      <Arrow
        from={[t.chick.x - 40, t.top - 52]}
        to={[t.chick.x + 14, t.chick.head - 10]}
        bow={-40}
      />,
    );
  },
  intro: () => {
    const t = set(
      ["The one-minute", "intro"],
      124,
      0,
      { rotate: -6, look: { x: -5, y: -2 } },
      { line: 0, from: "The ", word: "one-minute" },
    );

    return frame(
      "The one-minute intro",
      t.draw,
      <Hand text="starring me!" x={t.chick.x + 130} y={t.chick.y - 20} size={44} />,
      <Arrow
        from={[t.chick.x + 170, t.chick.y + 10]}
        to={[t.chick.x + 80, t.chick.y - 30]}
        bow={-30}
      />,
    );
  },
  examples: () => {
    const t = set(
      ["Look what", "it made"],
      176,
      -24,
      { rotate: 8, look: { x: 6, y: -4 } },
      { line: 1, from: "it ", word: "made" },
    );

    return frame(
      "Examples",
      t.draw,
      <Hand text="(i helped)" x={t.chick.x - 30} y={t.chick.y + 70} />,
    );
  },
  play: () => {
    const t = set(
      ["Poke it.", "It moves"],
      176,
      12,
      { rotate: 14, look: { x: 6, y: 6 } },
      { line: 1, from: "It ", word: "moves" },
    );

    return frame(
      "Playground",
      t.draw,
      [-150, -120, -60, -30].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const cx = t.chick.x;
        const cy = t.chick.y - 70;

        return (
          <path
            d={`M${cx + Math.cos(a) * 115} ${cy + Math.sin(a) * 115}L${cx + Math.cos(a) * 145} ${cy + Math.sin(a) * 145}`}
            stroke={CORAL}
            strokeWidth={5}
            strokeLinecap="round"
          />
        );
      }),
      <Hand text="hey!" x={t.chick.x + 120} y={t.chick.y - 170} size={48} />,
    );
  },
  lost: () => {
    const size = 360;
    const four = display.measure("4", size);
    const gap = 250;
    const x2 = X + four + gap;
    const base = 410;

    return frame(
      "Page not found",
      <>
        <Glyphs font={display} text="4" size={size} x={X} y={base} fill={INK} />
        <Chick x={X + four + gap / 2} y={base} size={1.75} rotate={-10} look={{ x: -4, y: -6 }} />
        <Glyphs font={display} text="4" size={size} x={x2} y={base} fill={INK} />
        <Glyphs
          font={display}
          text="This page wandered off."
          size={48}
          x={X}
          y={base + 84}
          fill={INK}
        />
        <Hand text="it wasn't me" x={X + four + gap / 2 - 110} y={92} size={44} />
        <Arrow
          from={[X + four + gap / 2 + 96, 104]}
          to={[X + four + gap / 2 + 20, 168]}
          bow={-24}
        />
      </>,
    );
  },
};

/** The card for one of the site's pages. */
export const card = (mood: Mood): string => CARDS[mood]();

/** The card for an example: its title, chick and all, beside its picture running off the card's right edge. */
export const exampleCard = (title: string, png: string, ratio: number): string => {
  const h = 400;
  const w = h * ratio;
  const x = 640;
  const y = (H - h) / 2;
  const words = title.split(" ");

  const fits = (size: number, width: number) => {
    const lines: string[] = [];

    for (const word of words) {
      const last = lines.at(-1);

      if (last !== undefined && display.measure(`${last} ${word}`, size) <= width)
        lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }

    return lines;
  };

  const size =
    [96, 84, 72, 62, 54].find(
      (s) => fits(s, 470).length <= 3 && fits(s, 470).every((l) => display.measure(l, s) <= 470),
    ) ?? 48;

  const lines = fits(size, 470);
  const t = set(lines, size, -24, { look: { x: 6, y: 2 } });

  return frame(
    title,
    <g clipPath={def.clipPath({}, <rect x={x} y={y} width={W} height={h} rx={22} />)}>
      <image
        href={`data:image/png;base64,${png}`}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMinYMid slice"
      />
    </g>,
    <rect
      x={x}
      y={y}
      width={W}
      height={h}
      rx={22}
      fill="none"
      stroke={systemLight.base02}
      strokeWidth={2}
    />,
    t.draw,
    <Hand text="made with svjeez!" x={X} y={H - 110} size={36} />,
  );
};

export default () => card("home");
