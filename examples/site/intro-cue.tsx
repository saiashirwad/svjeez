import { Ink, Once, Pivot, css as cssTag, ease, motion, render } from "svjeez";
import { css, theme } from "../style";
import { lettering, marker } from "./cue";
import { CHICK, GROUND, SQUASH, chick, jumps } from "./lib/chick";

// The way from the home page's hero to the intro reel. "watch the intro" is hand-lettered once, and above it the chick
// plays projector: its antenna bulb flickers on, a beam of light opens onto a little screen, and a play button pulses
// there while the chick bobs along to the show. It hops when the reel "ends" and the loop starts over.

const W = 420;
const H = 148;
const D = 6;
const S = 0.38;
const HOME = { x: 130, y: 84 };

/** Where the bulb sits on the page, so the beam starts from it. */
const BULB = { x: HOME.x, y: HOME.y - (162 - 38) * S };
const SCREEN = { x: 216, y: 10, w: 104, h: 64 };

export default function build(): string {
  const strokes = lettering("watch the intro");

  // The bulb flickers on like an old projector, holds, and dims before the loop ends.
  const glow = motion({ fill: CHICK.yellow })
    .at(0.4)
    .to({ fill: "#FFF3B0" }, 0.06)
    .to({ fill: CHICK.yellow }, 0.06)
    .to({ fill: "#FFF3B0" }, 0.06)
    .wait(4.3)
    .to({ fill: CHICK.yellow }, 0.3);

  const beam = motion({ opacity: 0 })
    .at(0.4)
    .to({ opacity: 0.5 }, 0.06)
    .to({ opacity: 0 }, 0.06)
    .to({ opacity: 0.5 }, 0.06)
    .wait(4.3)
    .to({ opacity: 0 }, 0.3);

  const play = motion({ scale: 1 })
    .at(0.8)
    .to({ scale: 1.2 }, 0.3, ease.out)
    .to({ scale: 1 }, 0.4, ease.inOut)
    .wait(0.6)
    .to({ scale: 1.2 }, 0.3, ease.out)
    .to({ scale: 1 }, 0.4, ease.inOut)
    .wait(0.6)
    .to({ scale: 1.2 }, 0.3, ease.out)
    .to({ scale: 1 }, 0.4, ease.inOut);

  // It bobs to the show, glancing at the screen, then hops when it ends.
  const bob = motion({ rotate: 0 })
    .at(0.9)
    .to({ rotate: 5 }, 0.5, ease.inOut)
    .to({ rotate: -5 }, 0.5, ease.inOut)
    .to({ rotate: 5 }, 0.5, ease.inOut)
    .to({ rotate: -5 }, 0.5, ease.inOut)
    .to({ rotate: 5 }, 0.5, ease.inOut)
    .to({ rotate: 0 }, 0.5, ease.inOut);

  const look = motion({ x: 0, y: 0 })
    .at(0.5)
    .to({ x: 6, y: -5 }, 0.3)
    .at(4.7)
    .to({ x: 0, y: 0 }, 0.3);

  const hops = jumps([{ land: 5.4, height: 50 }]);

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Watch the intro",
      desc: "The words watch the intro are handwritten while the yellow svjeez chick plays projector: its antenna bulb flickers on, a beam lights a little screen with a pulsing play button, and the chick bobs along to the show.",
      reducedMotion: { at: 2 },
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

      <path
        d={`M${BULB.x} ${BULB.y}L${SCREEN.x} ${SCREEN.y}V${SCREEN.y + SCREEN.h}Z`}
        fill="#FFE58A"
        animation={beam}
      />
      <rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.w}
        height={SCREEN.h}
        rx={8}
        fill={theme.base02}
      />
      <g transform={`translate(${SCREEN.x + SCREEN.w / 2} ${SCREEN.y + SCREEN.h / 2})`}>
        <path d="M-9 -12L13 0L-9 12Z" fill={theme.base09} animation={play} />
      </g>

      <g
        transform={`translate(${HOME.x} ${HOME.y}) scale(${S}) translate(${-GROUND.x} ${-GROUND.y})`}
      >
        <g animation={hops.body}>
          <Pivot origin={GROUND} animation={bob}>
            {chick({
              blinks: [1.9, 4.1],
              stretch: hops.stretch,
              bulb: hops.bulb,
              glow,
              look,
              feet: {},
            })}
          </Pivot>
        </g>
      </g>
    </>,
  );
}
