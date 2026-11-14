import { google } from "@svjeez/fonts";
import {
  Glyphs,
  Ink,
  Pivot,
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
const SKY: Color = "#DCEBFF";
const GREEN: Color = systemLight.base0B;
const BLUE: Color = systemLight.base0D;

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
const Hand = ({
  text,
  x,
  y,
  size = 34,
  fill = INK,
}: {
  text: string;
  x: number;
  y: number;
  size?: number;
  fill?: Color;
}) => <Ink d={casual.path(text, { size, x, y }).d} tool={pen} fill={fill} />;

/** The title wrapped into lines that fit `width`, at the largest size that takes three lines at most. */
const wrap = (text: string, width: number) => {
  for (const size of [76, 68, 60, 52, 46]) {
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

  return { lines: [text], size: 40 };
};

/** The title and the pitch under it, as one block centered in the space between the logo and the address. */
const Words = ({ title, line }: { title: string; line: string }) => {
  const { lines, size } = wrap(title, 560);
  const block = lines.length * size * 1.05 + 24 + lede(line).length * 30;
  const top = 150 + (430 - block) / 2 + size * 0.8;
  const below = top + (lines.length - 1) * size * 1.05 + 52;

  return (
    <>
      {lines.map((text, i) => (
        <Glyphs
          font={display}
          text={text}
          size={size}
          x={72}
          y={top + i * size * 1.05}
          fill={INK}
        />
      ))}
      {lede(line).map((row, i) => (
        <text x={72} y={below + i * 30} fontFamily={mono} fontSize={20} fill={SOFT}>
          {row}
        </text>
      ))}
    </>
  );
};

const sparkle = (x: number, y: number, r = 9, fill: Color = "#FFC21A") => (
  <path
    d={`M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`}
    fill={fill}
  />
);

/** A little landscape: sky, sun, hills, a kite. */
const Landscape = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={14} fill={SKY} />
    <circle cx={x + w * 0.8} cy={y + h * 0.28} r={h * 0.14} fill={CHICK.yellow} />
    <path
      d={`M${x} ${y + h * 0.75}C${x + w * 0.3} ${y + h * 0.55} ${x + w * 0.6} ${y + h * 0.62} ${x + w} ${y + h * 0.7}V${y + h - 14}Q${x + w} ${y + h} ${x + w - 14} ${y + h}H${x + 14}Q${x} ${y + h} ${x} ${y + h - 14}Z`}
      fill={GREEN}
    />
    <path d={`M${x + w * 0.28} ${y + h * 0.2}l16 22l-16 26l-16 -26Z`} fill={CORAL} />
  </>
);

export type Mood = "home" | "intro" | "examples" | "play" | "lost";

const SCENES: Record<Mood, { title: string; line: string; aside: string; art: () => Child }> = {
  home: {
    title: "Animated SVGs from TypeScript.",
    line: "One file. Zero JavaScript. Plays anywhere an <img> does.",
    aside: "it's all one <img>!",
    art: () => (
      <>
        <rect
          x={700}
          y={170}
          width={420}
          height={300}
          rx={8}
          fill="none"
          stroke={BLUE}
          strokeWidth={3}
          strokeDasharray="12 8"
        />
        {[
          [700, 170],
          [1120, 170],
          [700, 470],
          [1120, 470],
        ].map(([x, y]) => (
          <rect
            x={x! - 8}
            y={y! - 8}
            width={16}
            height={16}
            rx={3}
            fill={PAPER}
            stroke={BLUE}
            strokeWidth={3}
          />
        ))}
        <Landscape x={724} y={194} w={372} h={252} />
        <Chick x={910} y={176} size={0.9} look={{ x: -4, y: 4 }} />
        {sparkle(1000, 120)}
        {sparkle(1050, 150, 6, CORAL)}
      </>
    ),
  },
  intro: {
    title: "The one-minute intro.",
    line: "A whole reel, hosted by the chick, in a single SVG.",
    aside: "popcorn not included",
    art: () => (
      <>
        <path d="M842 266L960 160V380Z" fill="#FFE58A" opacity={0.8} />
        <rect x={960} y={150} width={200} height={240} rx={16} fill={INK} />
        <path d="M1040 236L1092 270L1040 304Z" fill={CORAL} />
        <text x={1060} y={366} textAnchor="middle" fontFamily={mono} fontSize={22} fill={PAPER}>
          1:00
        </text>
        <Chick x={800} y={420} size={1.25} look={{ x: 6, y: -4 }} />
      </>
    ),
  },
  examples: {
    title: "A gallery of tiny animated files.",
    line: "Scenes, charts, diagrams, maps and math. Each one is an SVG.",
    aside: "pick a card!",
    art: () => {
      const cards: [number, () => Child][] = [
        [-24, () => <circle cx={0} cy={-80} r={26} fill={CHICK.yellow} />],
        [
          -8,
          () => (
            <path
              d="M-50 -70Q-25 -110 0 -70T50 -70"
              fill="none"
              stroke={BLUE}
              strokeWidth={9}
              strokeLinecap="round"
            />
          ),
        ],
        [
          8,
          () => (
            <>
              {[0, 1, 2, 3].map((i) => (
                <rect
                  x={-46 + i * 25}
                  y={-40 - [30, 60, 40, 80][i]!}
                  width={18}
                  height={[30, 60, 40, 80][i]!}
                  rx={4}
                  fill={GREEN}
                />
              ))}
            </>
          ),
        ],
        [
          24,
          () => (
            <>
              {[0, 1, 2].map((i) => (
                <circle cx={-30 + i * 30} cy={-80 + (i % 2) * 20} r={10} fill={CORAL} />
              ))}
            </>
          ),
        ],
      ];

      return (
        <>
          {cards.map(([deg, picture], i) => (
            <g transform={`translate(${900 + (i - 1.5) * 70} 470) rotate(${deg} 0 0)`}>
              <rect
                x={-70}
                y={-200}
                width={140}
                height={200}
                rx={14}
                fill="#FFFFFF"
                stroke={systemLight.base02}
                strokeWidth={3}
              />
              {picture()}
            </g>
          ))}
          <Chick x={1100} y={520} size={0.85} rotate={-8} look={{ x: -6, y: -3 }} />
        </>
      );
    },
  },
  play: {
    title: "Play with svjeez.",
    line: "Drag a number or a handle, and the SVG recompiles as you go.",
    aside: "drag me!",
    art: () => (
      <>
        <rect x={720} y={140} width={400} height={330} rx={18} fill="#1B1A2E" />
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * 2 * Math.PI;

          return (
            <circle
              cx={920 + Math.cos(a) * 110}
              cy={290 + Math.sin(a) * 110}
              r={8}
              fill={i % 2 ? CHICK.yellow : CORAL}
            />
          );
        })}
        <circle cx={810} cy={290} r={14} fill="#16A34A" stroke="#FFFFFF" strokeWidth={5} />
        <Chick x={1040} y={470} size={0.8} look={{ x: -6, y: -6 }} />
      </>
    ),
  },
  lost: {
    title: "Lost on the timeline.",
    line: "This page isn't here, but the chick is looking for it.",
    aside: "where am i?",
    art: () => (
      <>
        <path
          d="M720 500C760 380 900 520 940 400S1100 320 1120 440"
          fill="none"
          stroke={SOFT}
          strokeWidth={4}
          strokeDasharray="4 14"
          strokeLinecap="round"
        />
        <Chick x={920} y={470} size={1.2} rotate={8} look={{ x: -5, y: -6 }} />
        <rect x={980} y={180} width={110} height={56} rx={28} fill="#9B5DE5" />
        <text
          x={1035}
          y={218}
          textAnchor="middle"
          fontFamily={mono}
          fontSize={28}
          fontWeight={700}
          fill="#FFFFFF"
        >
          ???
        </text>
      </>
    ),
  },
};

const frame = (
  left: Child,
  art: Child,
  aside: string,
  asideAt: { x: number; y: number },
  title: string,
) =>
  render(
    { width: W, height: H, duration: 1, title, reducedMotion: false },
    <>
      <rect width={W} height={H} fill={PAPER} />
      {Array.from({ length: 26 }, (_, i) =>
        Array.from({ length: 14 }, (_, j) => (
          <circle cx={24 + i * 46} cy={24 + j * 46} r={1.6} fill={systemLight.base02} />
        )),
      )}
      <g transform="translate(72 64) scale(0.25) translate(-38 -30)">{chick({ feet: {} })}</g>
      <Glyphs font={display} text="svjeez" size={32} x={118} y={100} fill={INK} />
      {left}
      <text x={72} y={H - 56} fontFamily={mono} fontSize={22} fill={SOFT}>
        svjeez.texoport.in
      </text>
      {art}
      <Hand text={aside} x={asideAt.x} y={asideAt.y} fill={CORAL} />
    </>,
  );

/** The pitch, wrapped into rows of mono that stay clear of the art. */
const lede = (line: string) => {
  const rows: string[] = [];

  for (const word of line.split(" ")) {
    const last = rows.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= 44)
      rows[rows.length - 1] = `${last} ${word}`;
    else rows.push(word);
  }

  return rows;
};

/** The card for one of the site's pages. */
export const card = (mood: Mood): string => {
  const s = SCENES[mood];
  const asideAt = {
    home: { x: 760, y: 560 },
    intro: { x: 760, y: 560 },
    examples: { x: 700, y: 120 },
    play: { x: 760, y: 560 },
    lost: { x: 740, y: 140 },
  }[mood];

  return frame(<Words title={s.title} line={s.line} />, s.art(), s.aside, asideAt, s.title);
};

/** The card for an example: its picture in a tilted window with the chick perched on top. */
export const exampleCard = (title: string, png: string, ratio: number): string => {
  const w = 460;
  const h = Math.min(320, w / ratio);

  return frame(
    <Words title={title} line="Made with svjeez: one self-contained animated SVG." />,
    <g transform={`rotate(-3 ${910} ${320})`}>
      <rect
        x={680}
        y={320 - h / 2 - 34}
        width={w + 20}
        height={h + 44}
        rx={16}
        fill="#FFFFFF"
        stroke={systemLight.base02}
        strokeWidth={3}
      />
      {[0, 1, 2].map((i) => (
        <circle
          cx={700 + i * 18}
          cy={320 - h / 2 - 16}
          r={5.5}
          fill={(["#FF5F57", "#FEBC2E", "#28C840"] as const)[i]!}
        />
      ))}
      <image
        href={`data:image/png;base64,${png}`}
        x={690}
        y={320 - h / 2}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
      />
      <Chick x={1060} y={320 - h / 2 - 34} size={0.6} look={{ x: -5, y: 4 }} />
    </g>,
    "look what it made!",
    { x: 700, y: 590 },
    title,
  );
};

export default () => card("home");
