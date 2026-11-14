import {
  Ink,
  Once,
  Pivot,
  css as cssTag,
  ease,
  motion,
  render,
  span,
  strokeFont,
  tool,
} from "svjeez";
import { css, theme } from "../style";
import { CHICK, GROUND, SQUASH, chick, jumps, waddle } from "./lib/chick";

// The way down from the home page's hero to its editor. The chick plays on top, "play with svjeez" is hand-lettered
// once under it. The chick: it waddles off, hops and spins,
// waddles the other way, trips on nothing and picks itself up, hops again and waddles home, in an 8 second loop.

const W = 420;
const H = 148;
const D = 8;
const S = 0.38;
const HOME = { x: W / 2, y: 84 };

const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
export const marker = tool.pen({ size: 3.4, seed: 7 });

/** Px on the page in the chick's own units. */
const u = (px: number) => px / S;

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

/** The words, centered in `width`, split into pen strokes one after another, paced by length. */
export const lettering = (text: string, width = W, y = 128) => {
  const probe = casual.path(text, { size: 40, x: 0, y: 0 }).d;
  const xs = (probe.match(/-?[\d.]+/g) ?? []).map(Number).filter((_, i) => i % 2 === 0);
  const wide = Math.max(...xs) - Math.min(...xs);

  const d = casual.path(text, {
    size: 40,
    x: (width - wide) / 2 - Math.min(...xs),
    y,
  }).d;

  let t = 0.3;

  return d.split(/(?=M)/).map((piece) => {
    const over = Math.max(0.06, lengthOf(piece) / 600);
    const stroke = { d: piece, at: t, over };
    t += over + 0.02;

    return stroke;
  });
};

export default function build(): string {
  const strokes = lettering("play with svjeez");

  const walks = [
    waddle(span(0.3, 1.2), u(100), 0, 5),
    waddle(span(3.1, 1.4), u(-200), 0, 7),
    waddle(span(6.8, 0.9), u(100), 0, 4),
  ];

  const hops = jumps([
    { land: 2.6, height: 70 },
    { land: 6.0, height: 36 },
  ]);

  // A full turn at the top of the first hop.
  const spin = motion({ rotate: 0 })
    .at(2.15)
    .to({ rotate: 360 }, 0.42, ease.inOut)
    .set({ rotate: 0 });

  // Trips over nothing, face down, and bounces back up.
  const trip = motion({ rotate: 0 })
    .at(4.55)
    .to({ rotate: -72 }, 0.2, ease.in)
    .to({ rotate: -64 }, 0.1, ease.out)
    .wait(0.35)
    .to({ rotate: 0 }, 0.45, ease.pop);

  // It looks where it is going, down at the words when it stops, and down at the ground after the trip.
  const look = motion({ x: 0, y: 0 })
    .at(0.2)
    .to({ x: 6, y: 0 }, 0.2)
    .at(1.6)
    .to({ x: -2, y: 5 }, 0.2)
    .at(3.0)
    .to({ x: -6, y: 0 }, 0.2)
    .at(5.3)
    .to({ x: 0, y: 4 }, 0.2)
    .at(6.7)
    .to({ x: 6, y: 0 }, 0.2)
    .at(7.6)
    .to({ x: 0, y: 0 }, 0.3);

  const glow = motion({ fill: CHICK.yellow })
    .at(2.3)
    .to({ fill: "#FFF3B0" }, 0.1)
    .to({ fill: CHICK.yellow }, 0.5);

  const travel = walks.map((w) => w.body[0]!);
  const steps = walks.flatMap((w) => w.body.slice(1));

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Play with svjeez",
      desc: "The words play with svjeez are handwritten while the yellow svjeez chick waddles, hops and spins, trips and picks itself up above them.",
      reducedMotion: { at: D - 0.01 },
      css: cssTag(Object.assign([css, ""], { raw: [css, ""] }), SQUASH),
    },
    <>
      <Once>
        {strokes.map((s) => (
          <Ink
            d={s.d}
            tool={marker}
            fill={theme.base05}
            draw={{ at: s.at, over: s.over }}
            ease={ease.linear}
          />
        ))}
      </Once>

      <g
        transform={`translate(${HOME.x} ${HOME.y}) scale(${S}) translate(${-GROUND.x} ${-GROUND.y})`}
      >
        <g animation={travel}>
          <g animation={hops.body}>
            <Pivot origin={{ x: GROUND.x, y: 110 }} animation={spin}>
              <Pivot origin={{ x: 44, y: GROUND.y + 4 }} animation={trip}>
                {chick({
                  blinks: [1.7, 5.4, 7.3],
                  body: steps,
                  stretch: hops.stretch,
                  bulb: hops.bulb,
                  glow,
                  look,
                  feet: {
                    left: walks.map((w) => w.feet.left),
                    right: walks.map((w) => w.feet.right),
                  },
                })}
              </Pivot>
            </Pivot>
          </g>
        </g>
      </g>
    </>,
  );
}
