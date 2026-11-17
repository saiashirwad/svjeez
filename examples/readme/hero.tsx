import { google } from "@svjeez/fonts";
import {
  Arrow,
  Glyphs,
  Ink,
  draw,
  fitText,
  ease,
  enter,
  motion,
  render,
  span,
  stagger,
  strokeFont,
  tool,
  variables,
} from "svjeez";
import { css as codeCss, theme } from "../style";
import { GROUND, SQUASH, blip, flight, jumps } from "../site/lib/blip";

// The README's hero, the share card come to life. The title sets itself, a highlighter swipes under "TypeScript", and
// Blip hops in from the right to stand in for the full stop. A note inks on to point out that the whole thing is
// one <img>, Blip looks the title over, and it all clears for the next round. It follows light and dark.

const W = 960;
const H = 400;
const D = 10;
const X = 48;

const display = await google("Inter Tight", { weight: 800 });
const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
const pen = tool.pen({ size: 2.8, seed: 4 });

const { vars, css: paint } = variables({ dark: { swipe: "#7A5A00" }, light: { swipe: "#FFE07A" } });

const LINES = ["Animated SVGs", "from TypeScript"];
const LEAD = 0.96;
const last = LINES.length - 1;

// As large as fits, with Blip, about one em wide, at the end of the last line.
const size = fitText(display, LINES, { width: W - 2 * X, max: 120, tail: 0.98 });

const top = (H - size * 0.72 - last * size * LEAD) / 2 + 22;
const base = (i: number) => top + size * 0.72 + i * size * LEAD;
const scale = size / 150;

/** Where Blip stands: the full stop's place. */
const SPOT = { x: X + display.measure(LINES[last]!, size) + size * 0.56, y: base(last) };

const leave = motion({ opacity: 1 }).to({ opacity: 0 }, span(D - 1, 0.5));

/** Each word rises into place, one after another. */
const rise = stagger(span(0.2, 0.5), LINES.join(" ").split(" ").length, 0.14);
let next = 0;

const words = LINES.flatMap((line, i) => {
  let x = X;

  return line.split(" ").map((word) => {
    const node = (
      <g animation={[enter(rise[next++]!, { opacity: 0, y: 24 }, ease.out), leave]}>
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

/** Blip hops in from off the right edge, two hops, and lands on the spot. */
const HOPS = [
  { land: 2.0, height: 70 },
  { land: 3.05, height: 46 },
];

const hop = jumps(HOPS);
const startX = (W + 120 - SPOT.x) / scale;
const midX = (W - 60 - SPOT.x) / scale;

/** Blip drifts left only while it is in the air. */
const slide = motion({ x: startX })
  .to({ x: midX }, flight(HOPS[0]!), ease.linear)
  .to({ x: 0 }, flight(HOPS[1]!), ease.linear);

const look = motion({ x: -5, y: 0 })
  .to({ x: -6, y: 4 }, span(3.4, 0.3), ease.inOut)
  .to({ x: 5, y: -5 }, span(5.2, 0.35), ease.inOut)
  .to({ x: -4, y: 3 }, span(6.6, 0.35), ease.inOut)
  .to({ x: -5, y: 0 }, span(D - 0.4, 0.3));

/** The note and its arrow, above the title and pointing down at Blip. */
const NOTE = "that's one <img>!";
const noteSize = 34;
const note = casual.path(NOTE, { size: noteSize, x: SPOT.x - 330 * (noteSize / 38), y: top - 34 });
const head = { x: SPOT.x + 12, y: SPOT.y - size * 0.95 - 8 };
const tail = { x: SPOT.x - 30, y: top - 46 };
// The shaft bows 34px sideways at its middle, whatever the title's size puts between tail and head.
// The shaft draws from 4.75s to 5.05s and the head lands as it ends, as in the original hero.

export default () =>
  render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez: animated SVGs from TypeScript",
      desc: 'The title "Animated SVGs from TypeScript" rises in word by word and a yellow highlighter swipes under TypeScript. Blip, the svjeez mascot, hops in from the right and lands where the full stop goes. A hand-lettered note inks on above it, "that\'s one <img>!", with an arrow pointing down at Blip, which looks the title over before it all fades for the next round.',
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
          {blip({
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
        <Arrow
          from={tail}
          to={head}
          bend={-34 / (head.y - tail.y)}
          width={3}
          head={14}
          theme={theme}
          show={span(4.5).until(D)}
          draw={span(4.75, 0.3)}
          ease={ease.inOut}
        />
      </g>
    </>,
  );
