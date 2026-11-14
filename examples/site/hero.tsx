import { highlight } from "@svjeez/code";
import {
  code,
  css,
  def,
  draw,
  ease,
  motion,
  Pivot,
  render,
  variables,
  wiggle,
  type Color,
  type Stack,
  type TagChannels,
} from "svjeez";
import { css as codeCss, mono, theme } from "../style";
import { chrome } from "./lib/kit";
import { CHICK, GROUND, SQUASH, chick, jumps } from "./lib/chick";

// The home page's hero. A scene's source fills in line by line, and the chick hops down it like the ball over karaoke
// lyrics. Each word it lands on pops into the picture beside it as what it names: a sun (a moon at night), hills, a
// kite and a cloud. The chick jumps into the picture it made, holds the kite string, and the loop starts over. A
// selection marquee around the whole file says it is all one image.
//
// Flat shapes only, no outlines, to match the chick.

/** The scene is drawn on a 960 by 420 page and shown cropped to the cards, with room above for the chick. */
const CROP = { x: 12, y: -44 };
const W = 960 - 2 * CROP.x;
const H = 408 - CROP.y;

/** A design tool's selection around the whole picture, ants marching, with a handle at each corner: all of it is one image. */
const MARQUEE = { x: CROP.x + 5, y: CROP.y + 5, width: W - 10, height: H - 10 };
const ANTS = `.ants{stroke-dasharray:7 5;animation:ants .9s linear infinite}@keyframes ants{to{stroke-dashoffset:-12}}@media (prefers-reduced-motion:reduce){.ants{animation:none}}`;
const D = 14;

const SRC = `render(<>
  <Sun animation={glow} />
  <Hills animation={rise} />
  <Kite animation={wiggle} />
  <Cloud animation={drift} />
</>)`;

const { vars, css: paint } = variables(
  {
    sky: "#2c3440",
    mist: "#8fa3b8",
    hill: "#5f9e76",
    far: "#47785a",
    cloud: "#e9e2d4",
    string: "#e9e2d4",
    sun: "#f3ecd2",
    bite: "#2c3440",
    ray: "transparent",
    star: "#f3ecd2",
  },
  {
    sky: "#cfe6ee",
    mist: "#8fb8c7",
    hill: "#7fbf8f",
    far: "#a5d4ad",
    cloud: "#ffffff",
    string: "#3b3a45",
    sun: "#FFC21A",
    bite: "transparent",
    ray: "#FFC21A",
    star: "transparent",
  },
);

const CORAL = CHICK.cheek;
const YELLOW = CHICK.yellow;
const LIT = "#FFF3B0";

/** The two cards: the source on the left, the picture on the right. */
const SOURCE = { x: 40, y: 60, width: 420, height: 320 };
const PICTURE = { x: 500, y: 60, width: 420, height: 320 };
const HEADER = 40;

/** The window's corner, less its 1px border, so the sky fits inside it. */
const R = 11;

const layout = (src: string) =>
  code(highlight(src, "tsx"), {
    x: SOURCE.x + 34,
    y: SOURCE.y + HEADER + 18,
    fontSize: 18,
    lineHeight: 2.2,
    theme,
    font: mono,
  });

// At night the source says Moon, and the picture draws one. The file carries both and the viewer's scheme picks.
const listing = layout(SRC);
const nightly = layout(SRC.replace("<Sun", "<Moon"));

const SCHEME = `.night{display:none}@media (prefers-color-scheme:dark){.day{display:none}.night{display:inline}}`;

/** The chick, drawn at this size, stands on a word's letters. */
const SIZE = 0.4;

const stand = (word: { center: { x: number; y: number } }) => ({
  x: word.center.x,
  y: word.center.y - 8,
});

// What each word the chick lands on turns into, and where it goes in the picture.
const sky = {
  x: PICTURE.x + 1,
  y: PICTURE.y + HEADER,
  width: PICTURE.width - 2,
  height: PICTURE.height - HEADER - 1,
};

const FLOOR = sky.y + sky.height;

const HILL = `M${sky.x + R} ${FLOOR}Q${sky.x} ${FLOOR} ${sky.x} ${FLOOR - R}L${sky.x} ${FLOOR - 58}C${sky.x + 70} ${FLOOR - 100} ${sky.x + 150} ${FLOOR - 104} ${sky.x + 230} ${FLOOR - 70}C${sky.x + 300} ${FLOOR - 42} ${sky.x + 360} ${FLOOR - 50} ${sky.x + sky.width} ${FLOOR - 66}L${sky.x + sky.width} ${FLOOR - R}Q${sky.x + sky.width} ${FLOOR} ${sky.x + sky.width - R} ${FLOOR}Z`;
const FAR = `M${sky.x} ${FLOOR - 40}C${sky.x + 120} ${FLOOR - 70} ${sky.x + 220} ${FLOOR - 130} ${sky.x + 330} ${FLOOR - 112}C${sky.x + 380} ${FLOOR - 104} ${sky.x + 400} ${FLOOR - 96} ${sky.x + sky.width} ${FLOOR - 92}L${sky.x + sky.width} ${FLOOR}L${sky.x} ${FLOOR}Z`;

/** The top of the near hill, where the chick ends up. */
const SUMMIT = { x: sky.x + 150, y: FLOOR - 95 };

const circle = (r: number) => `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;
const KITE_TAIL = 34;
const KITE = `M0 -30L22 0L0 ${KITE_TAIL}L-22 0Z`;

const CLOUD =
  "M-46 14C-62 14 -62 -8 -46 -10C-46 -28 -22 -34 -12 -20C-4 -38 26 -36 28 -14C46 -18 56 4 40 14Z";

interface Piece {
  readonly word: string;
  readonly color: Color;
  /** Where the piece's middle ends up. */
  readonly to: { x: number; y: number };
  /** Its outline, drawn about its middle. */
  readonly outline: string;
}

const PIECES: readonly Piece[] = [
  { word: "Sun", color: "var(--sun)", to: { x: sky.x + 340, y: sky.y + 62 }, outline: circle(30) },
  { word: "rise", color: "var(--hill)", to: { x: sky.x + 210, y: FLOOR - 50 }, outline: "" },
  { word: "Kite", color: CORAL, to: { x: sky.x + 90, y: sky.y + 80 }, outline: KITE },
  { word: "drift", color: "var(--cloud)", to: { x: sky.x + 220, y: sky.y + 54 }, outline: CLOUD },
];

/** A wavy underline from x0 to x1 along y, one bump every 7px or so. */
const squiggle = (x0: number, x1: number, y: number) => {
  const n = Math.max(2, Math.round((x1 - x0) / 7));
  const step = (x1 - x0) / n;
  let d = `M${+x0.toFixed(1)} ${y}`;

  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * step;
    d += `Q${+cx.toFixed(1)} ${y + (i % 2 ? 3 : -3)} ${+(x0 + (i + 1) * step).toFixed(1)} ${y}`;
  }

  return d;
};

/** Plain CSS text ahead of CSS that names registered properties. */
const withText = (text: string, rest: ReturnType<typeof css>) =>
  css(Object.assign([text, ""], { raw: [text, ""] }), rest);

export default function build(): string {
  const words = PIECES.map((p) => listing.find(p.word));
  const moon = nightly.find("Moon");

  // The chick starts on the source card's top edge and lands on one word per line. Each line drops into the source
  // just before the chick jumps for it.
  const lands = [2.2, 3.6, 5.0, 6.4];
  const appear = lands.map((t) => t - 0.95);
  const start = { x: SOURCE.x + SOURCE.width - 60, y: SOURCE.y };

  const finale = lands.at(-1)! + 1.5;
  const spots = [...words.map(stand), SUMMIT];
  const times = [...lands, finale];
  const HOP = 90;

  // Two happy hops on the hill while the picture plays.
  const hops = jumps([
    ...times.map((land, i) => ({
      land,
      height: i === times.length - 1 ? 220 : i === 0 ? 40 : HOP,
    })),
    { land: finale + 2.4, height: 40 },
    { land: finale + 3.5, height: 40 },
  ]);

  // Between landings the chick travels in a straight line while its hop arcs it up and over.
  const travel = times.reduce(
    (m, land, i) => {
      const air =
        2 *
        0.2 *
        Math.sqrt(
          Math.min(1, Math.max(0.25, (i === times.length - 1 ? 220 : i === 0 ? 40 : HOP) / 64)),
        );

      return m.at(land - air).to({ x: spots[i]!.x, y: spots[i]!.y }, air, ease.linear);
    },
    motion({ x: start.x, y: start.y }),
  );

  const OUT = D - 0.7;

  const pop = motion({ scale: 0 })
    .at(0.05)
    .to({ scale: 1 }, 0.35, ease.pop)
    .at(OUT + 0.15)
    .to({ scale: 0 }, 0.25, ease.in);

  // The bulb flashes on every word, as if it read it.
  const glow = times
    .slice(0, -1)
    .reduce(
      (m, t) => m.at(t).to({ fill: LIT }, 0.05).to({ fill: YELLOW }, 0.45),
      motion({ fill: YELLOW }),
    );

  // It watches each piece fly off to the right, and looks up at the sun from the hill.
  const look = times.reduce(
    (m, t, i) =>
      i === times.length - 1
        ? m.at(t + 0.2).to({ x: 5, y: -6 }, 0.3, ease.inOut)
        : m
            .at(t + 0.1)
            .to({ x: 6, y: -1 }, 0.25, ease.out)
            .at(t + 0.75)
            .to({ x: 0, y: 2 }, 0.3, ease.inOut),
    motion({ x: 0, y: 2 }),
  );

  // Each word pops into the picture where it belongs, a moment after the chick lands on it.
  const popAt = (i: number) => lands[i]! + 0.12;

  const popIn = (i: number) =>
    motion({ scale: 0 })
      .at(popAt(i))
      .to({ scale: 1 }, 0.45, ease.pop)
      .at(OUT + i * 0.06)
      .to({ scale: 0 }, 0.3, ease.in);

  // The underline under each word fades with the rest of the source at the end of the loop.
  const mark = () => motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.3);

  const fade = motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.4, ease.in);

  // A little burst of sparks under the chick's feet on every word.
  const burstAt = lands.reduce(
    (m, t, i) => m.at(t).set({ x: spots[i]!.x, y: spots[i]!.y }),
    motion({ x: spots[0]!.x, y: spots[0]!.y }),
  );

  const spark = (a: number) =>
    lands.reduce(
      (m, t) =>
        m
          .at(t)
          .set({ x: 0, y: 0, opacity: 1 })
          .to(
            { x: +(22 * Math.cos(a)).toFixed(1), y: +(22 * Math.sin(a)).toFixed(1), opacity: 0 },
            0.35,
            ease.out,
          ),
      motion({ x: 0, y: 0, opacity: 0 }),
    );

  // A ring of sparks where each piece pops in.
  const popBurstAt = PIECES.reduce(
    (m, p, i) => m.at(popAt(i)).set({ x: p.to.x, y: p.to.y }),
    motion({ x: PIECES[0]!.to.x, y: PIECES[0]!.to.y }),
  );

  const popSpark = (a: number) =>
    PIECES.reduce(
      (m, _, i) =>
        m
          .at(popAt(i))
          .set({ x: 0, y: 0, opacity: 1 })
          .to(
            { x: +(52 * Math.cos(a)).toFixed(1), y: +(52 * Math.sin(a)).toFixed(1), opacity: 0 },
            0.45,
            ease.out,
          ),
      motion({ x: 0, y: 0, opacity: 0 }),
    );

  // Once each piece is in, it starts doing what its word says.
  const settle = (i: number) => popAt(i) + 0.3;
  const rays = motion({ rotate: 0 }).to({ rotate: 36 }, D, ease.linear);

  const beam = motion({ opacity: 0, scale: 0.6 })
    .at(settle(0))
    .to({ opacity: 1, scale: 1 }, 0.4, ease.pop);

  const flutter = wiggle({ rotate: 7 }, { seed: "kite", rate: 2 });
  const tail = draw({ at: settle(2), over: 0.6 });

  const drift = motion({ x: 0 })
    .at(settle(3))
    .to({ x: -36 }, D - 0.8 - settle(3), ease.inOut);

  const near = motion({ y: 140 })
    .at(popAt(1))
    .to({ y: 0 }, 0.55, ease.pop)
    .at(OUT)
    .to({ y: 140 }, 0.5, ease.in);

  const far = motion({ y: 160 })
    .at(settle(1))
    .to({ y: 0 }, 0.6, ease.pop)
    .at(OUT)
    .to({ y: 160 }, 0.5, ease.in);

  // render(<> and </>) are there from the start; each line in between opens a gap, pushing the closing line down.
  const row = listing.metrics.height;

  const wordsOf = (c: typeof listing, n: number) =>
    c.words.filter((w) => w.line === n).map((w) => c.draw(w));

  const lineOf = (n: number, animation: Stack<TagChannels<"g">>) => (
    <g animation={animation}>
      {n === 2 ? (
        <>
          <g class="day">{wordsOf(listing, n)}</g>
          <g class="night">{wordsOf(nightly, n)}</g>
        </>
      ) : (
        wordsOf(listing, n)
      )}
    </g>
  );

  const arrive = motion({ opacity: 0 }).at(0.1).to({ opacity: 1 }, 0.3);

  const closing = appear.reduce(
    (m, t, i) => m.at(t).to({ y: -(appear.length - 1 - i) * row }, 0.35, ease.inOut),
    motion({ opacity: 0, y: -appear.length * row })
      .at(0.1)
      .to({ opacity: 1 }, 0.3),
  );

  const source = (
    <>
      {lineOf(1, arrive)}
      {appear.map((t, i) =>
        lineOf(
          i + 2,
          motion({ opacity: 0, y: -10 })
            .at(t + 0.3)
            .to({ opacity: 1, y: 0 }, 0.35, ease.pop),
        ),
      )}
      {lineOf(appear.length + 2, closing)}
    </>
  );

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A chick hops down a scene's source and builds its picture",
      desc: "A few lines of svjeez source fill in one at a time. A chick hops down them word by word, and each word it lands on pops into the picture beside it as what it names: a sun, or a moon at night, hills, a kite and a cloud. The chick jumps onto the hill, holds the kite string, and everything clears for the next round.",
      reducedMotion: { at: finale + 0.6 },
      css: withText(codeCss + paint + SCHEME + ANTS, SQUASH),
    },
    <>
      <g transform={`translate(${-CROP.x} ${-CROP.y})`}>
        <rect
          class="ants"
          {...MARQUEE}
          rx={4}
          fill="none"
          stroke={theme.base0D}
          strokeWidth={1.5}
        />
        {[
          [MARQUEE.x, MARQUEE.y],
          [MARQUEE.x + MARQUEE.width, MARQUEE.y],
          [MARQUEE.x, MARQUEE.y + MARQUEE.height],
          [MARQUEE.x + MARQUEE.width, MARQUEE.y + MARQUEE.height],
        ].map(([x, y]) => (
          <rect
            x={x! - 4}
            y={y! - 4}
            width={8}
            height={8}
            rx={1.5}
            fill={theme.base00}
            stroke={theme.base0D}
            strokeWidth={1.5}
          />
        ))}
        {/* Two windows in the reader's palette: the source, and the picture it draws. */}
        <g transform={`translate(${SOURCE.x} ${SOURCE.y})`}>
          {chrome(SOURCE.width, SOURCE.height, "scene.tsx", { bar: HEADER, mono: true }).node}
        </g>
        {PIECES.map((p, i) => {
          const marker = (w: typeof moon, cls?: string) => (
            <path
              class={cls}
              d={squiggle(w.x + 2, w.x + w.w - 2, w.center.y + 12)}
              fill="none"
              stroke={p.word === "drift" ? vars.mist : p.color}
              strokeWidth={3}
              strokeLinecap="round"
              animation={[draw({ at: lands[i]!, over: 0.25 }), mark()]}
            />
          );

          return i === 0 ? (
            <>
              {marker(words[0]!, "day")}
              {marker(moon, "night")}
            </>
          ) : (
            marker(words[i]!)
          );
        })}
        <g animation={fade}>{source}</g>

        {/* The picture card. */}
        <g transform={`translate(${PICTURE.x} ${PICTURE.y})`}>
          {chrome(PICTURE.width, PICTURE.height, "scene.svg", { bar: HEADER, mono: true }).node}
        </g>
        <path
          d={`M${sky.x} ${sky.y}H${sky.x + sky.width}V${FLOOR - R}A${R} ${R} 0 0 1 ${sky.x + sky.width - R} ${FLOOR}H${sky.x + R}A${R} ${R} 0 0 1 ${sky.x} ${FLOOR - R}Z`}
          fill={vars.sky}
        />

        {/* The hills come up out of the ground, the far one just after the near one. */}
        <g clipPath={def.clipPath({}, <rect {...sky} />)}>
          <g animation={far}>
            <path d={FAR} fill={vars.far} />
          </g>
          <g animation={near}>
            <path d={HILL} fill={vars.hill} />
          </g>
        </g>

        {/* The sun, its rays, and at night a bite of sky that makes it a moon, with a few stars. */}
        <g transform={`translate(${PIECES[0]!.to.x} ${PIECES[0]!.to.y})`}>
          <g animation={[beam, motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.3)]}>
            <g animation={rays}>
              {Array.from({ length: 10 }, (_, i) => (
                <rect
                  x={40}
                  y={-4}
                  width={14}
                  height={8}
                  rx={4}
                  fill={vars.ray}
                  transform={`rotate(${i * 36})`}
                />
              ))}
            </g>
          </g>
          <g animation={popIn(0)}>
            <path d={circle(30)} fill={PIECES[0]!.color} />
            <circle cx={13} cy={-9} r={25} fill={vars.bite} />
          </g>
        </g>
        {[
          [sky.x + 40, sky.y + 30, 0],
          [sky.x + 160, sky.y + 22, 0.15],
          [sky.x + 270, sky.y + 40, 0.3],
          [sky.x + 390, sky.y + 120, 0.45],
          [sky.x + 30, sky.y + 140, 0.6],
        ].map(([x, y, d]) => (
          <circle
            cx={x}
            cy={y}
            r={2.5}
            fill={vars.star}
            animation={motion({ opacity: 0, scale: 0 })
              .at(settle(0) + d!)
              .to({ opacity: 1, scale: 1 }, 0.3, ease.pop)
              .at(OUT)
              .to({ opacity: 0 }, 0.3)}
          />
        ))}

        {/* The kite swings from the end of its string, and the string runs down to the hill. */}
        <g animation={motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.3)}>
          <path
            d={`M${PIECES[2]!.to.x} ${PIECES[2]!.to.y + KITE_TAIL}C${PIECES[2]!.to.x + 10} ${PIECES[2]!.to.y + 90} ${PIECES[2]!.to.x + 50} ${PIECES[2]!.to.y + 110} ${SUMMIT.x - 10} ${SUMMIT.y - 10}`}
            fill="none"
            stroke={vars.string}
            strokeWidth={2}
            strokeLinecap="round"
            animation={tail}
          />
        </g>
        <g transform={`translate(${PIECES[2]!.to.x} ${PIECES[2]!.to.y})`}>
          <Pivot origin={{ x: 0, y: KITE_TAIL }} animation={[popIn(2), flutter]}>
            <path d={KITE} fill={PIECES[2]!.color} />
          </Pivot>
        </g>

        <g transform={`translate(${PIECES[3]!.to.x} ${PIECES[3]!.to.y})`}>
          <g animation={popIn(3)}>
            <g animation={drift}>
              <path d={CLOUD} fill={PIECES[3]!.color} />
            </g>
          </g>
        </g>

        <g animation={popBurstAt}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <circle r={3.5} fill={YELLOW} animation={popSpark((deg * Math.PI) / 180)} />
          ))}
        </g>

        <g animation={burstAt}>
          {[-160, -125, -55, -20].map((deg) => (
            <circle r={3.5} fill={YELLOW} animation={spark((deg * Math.PI) / 180)} />
          ))}
        </g>

        {/* The chick. */}
        <g animation={travel}>
          <g transform={`scale(${SIZE}) translate(${-GROUND.x} ${-GROUND.y})`}>
            <Pivot origin={GROUND} animation={pop}>
              {chick({
                blinks: [1.2, 4.6, finale + 0.9],
                body: hops.body,
                stretch: hops.stretch,
                bulb: hops.bulb,
                glow,
                look,
                feet: {},
              })}
            </Pivot>
          </g>
        </g>
      </g>
    </>,
  );
}
