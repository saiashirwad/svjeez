import { google } from "@svjeez/fonts";
import {
  Glyphs,
  Ink,
  draw,
  ease,
  enter,
  motion,
  render,
  strokeFont,
  tool,
  variables,
} from "svjeez";
import { css as codeCss, theme } from "../style";
import { GROUND, SQUASH, chick, hopTime, jumps } from "../site/lib/chick";

// The README's hero, the share card come to life. The title sets itself, a highlighter swipes under "TypeScript", and
// the chick hops in from the right to stand in for the full stop. A note inks on to point out that the whole thing is
// one <img>, the chick looks the title over, and it all clears for the next round. It follows light and dark.

const W = 960;
const H = 400;
const D = 10;
const X = 48;

const display = await google("Inter Tight", { weight: 800 });
const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
const pen = tool.pen({ size: 2.8, seed: 4 });

const { vars, css: paint } = variables({ swipe: "#7A5A00" }, { swipe: "#FFE07A" });

const LINES = ["Animated SVGs", "from TypeScript"];
const LEAD = 0.96;
const last = LINES.length - 1;

// As large as fits, with the chick, about one em wide, at the end of the last line.
const widest = (size: number) =>
  Math.max(...LINES.map((line, i) => display.measure(line, size) + (i === last ? size * 0.98 : 0)));

let size = 120;

while (widest(size) > W - 2 * X) size -= 2;

const top = (H - size * 0.72 - last * size * LEAD) / 2 + 22;
const base = (i: number) => top + size * 0.72 + i * size * LEAD;
const scale = size / 150;

/** Where the chick stands: the full stop's place. */
const SPOT = { x: X + display.measure(LINES[last]!, size) + size * 0.56, y: base(last) };

const OUT = { at: D - 1, over: 0.5 };
const leave = motion({ opacity: 1 }).at(OUT.at).to({ opacity: 0 }, OUT.over);

/** Each word rises into place, one after another. */
const words = LINES.flatMap((line, i) => {
  let x = X;

  return line.split(" ").map((word, j) => {
    const at = 0.2 + (i * 2 + j) * 0.14;

    const node = (
      <g animation={[enter({ at, over: 0.5 }, { opacity: 0, y: 24 }, ease.out), leave]}>
        <Glyphs font={display} text={word} size={size} x={x} y={base(i)} fill={theme.base05} />
      </g>
    );

    x += display.measure(`${word} `, size);

    return node;
  });
});

/** The highlighter swipe under "TypeScript", drawn on left to right as one fat stroke. */
const from = X + display.measure("from ", size);
const swipeW = display.measure("TypeScript", size);
const swipeY = base(1) - size * 0.27;

/** The chick hops in from off the right edge, two hops, and lands on the spot. */
const HOPS = [
  { land: 2.0, height: 70 },
  { land: 3.05, height: 46 },
];

const hop = jumps(HOPS);
const startX = (W + 120 - SPOT.x) / scale;
const midX = (W - 60 - SPOT.x) / scale;

const slide = motion({ x: startX })
  .at(HOPS[0]!.land - hopTime(HOPS[0]!.height) + 0.3)
  .to({ x: midX }, HOPS[0]!.land - (HOPS[0]!.land - hopTime(HOPS[0]!.height) + 0.3), ease.linear)
  .at(HOPS[1]!.land - hopTime(HOPS[1]!.height) + 0.3)
  .to({ x: 0 }, HOPS[1]!.land - (HOPS[1]!.land - hopTime(HOPS[1]!.height) + 0.3), ease.linear);

const look = motion({ x: -5, y: 0 })
  .at(3.4)
  .to({ x: -6, y: 4 }, 0.3, ease.inOut)
  .at(5.2)
  .to({ x: 5, y: -5 }, 0.35, ease.inOut)
  .at(6.6)
  .to({ x: -4, y: 3 }, 0.35, ease.inOut)
  .at(D - 0.4)
  .to({ x: -5, y: 0 }, 0.3);

/** The note and its arrow, above the title and pointing down at the chick. */
const NOTE = "that's one <img>!";
const noteSize = 34;
const note = casual.path(NOTE, { size: noteSize, x: SPOT.x - 330 * (noteSize / 38), y: top - 34 });
const head = { x: SPOT.x + 12, y: SPOT.y - size * 0.95 - 8 };
const tail = { x: SPOT.x - 30, y: top - 46 };
const mid = { x: (tail.x + head.x) / 2 + 34, y: (tail.y + head.y) / 2 - 18 };

const angle = Math.atan2(head.y - mid.y, head.x - mid.x);

const barb = (turn: number) =>
  `M${head.x} ${head.y}L${head.x - 14 * Math.cos(angle + turn)} ${head.y - 14 * Math.sin(angle + turn)}`;

export default () =>
  render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez: animated SVGs from TypeScript",
      desc: 'The title "Animated SVGs from TypeScript" rises in word by word and a yellow highlighter swipes under TypeScript. A little yellow chick hops in from the right and lands where the full stop goes. A hand-lettered note inks on above it, "that\'s one <img>!", with an arrow pointing down at the chick, which looks the title over before it all fades for the next round.',
      reducedMotion: { at: 7.5 },
      css: `${codeCss}${paint}${SQUASH}`,
    },
    <>
      <path
        d={`M${from - 8} ${swipeY + 3}L${from + swipeW + 10} ${swipeY - 3}`}
        stroke={vars.swipe}
        strokeWidth={size * 0.48}
        animation={[draw({ at: 1.15, over: 0.5 }, ease.inOut), leave]}
      />
      {words}
      <g
        transform={`translate(${SPOT.x} ${SPOT.y + size * 0.02}) scale(${scale}) translate(${-GROUND.x} ${-GROUND.y})`}
      >
        <g animation={[slide, leave]}>
          {chick({
            body: hop.body,
            stretch: hop.stretch,
            bulb: hop.bulb,
            look,
            blinks: [4.4, 6.1, 8.2],
            feet: {},
          })}
        </g>
      </g>
      <g animation={leave}>
        <Ink
          d={note.d}
          tool={pen}
          fill={theme.base09}
          draw={{ at: 3.6, over: 1.1 }}
          ease={ease.linear}
        />
        <path
          d={`M${tail.x} ${tail.y}Q${mid.x} ${mid.y} ${head.x} ${head.y}${barb(0.5)}${barb(-0.5)}`}
          fill="none"
          stroke={theme.base09}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          animation={draw({ at: 4.7, over: 0.5 }, ease.inOut)}
        />
      </g>
    </>,
  );
