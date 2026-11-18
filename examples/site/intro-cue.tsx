import { Ink, Once, Pivot, chain, css as cssTag, ease, motion, render, span } from "svjeez";
import { css, theme } from "../style";
import { lettering, marker } from "./cue";
import { BLIP, GROUND, SQUASH, blip, jumps } from "./lib/blip";

const W = 420;
const H = 148;
const D = 6;
const S = 0.38;
const HOME = { x: 130, y: 84 };

const BULB = { x: HOME.x, y: HOME.y - (162 - 38) * S };
const SCREEN = { x: 216, y: 10, w: 104, h: 64 };

export default function build(): string {
  const strokes = lettering("watch the intro");

  const [on, off, again] = chain(span(0.4, 0.06), 0.06, 0.06);
  const dim = again.next(0.3, 4.3);

  const glow = motion({ fill: BLIP.yellow })
    .to({ fill: "#FFF3B0" }, on)
    .to({ fill: BLIP.yellow }, off)
    .to({ fill: "#FFF3B0" }, again)
    .to({ fill: BLIP.yellow }, dim);

  const beam = motion({ opacity: 0 })
    .to({ opacity: 0.5 }, on)
    .to({ opacity: 0 }, off)
    .to({ opacity: 0.5 }, again)
    .to({ opacity: 0 }, dim);

  let pulse = span(0.8, 0.3);
  let play = motion({ scale: 1 });

  for (let i = 0; i < 3; i++) {
    const settle = pulse.next(0.4);

    play = play.to({ scale: 1.2 }, pulse, ease.out).to({ scale: 1 }, settle, ease.inOut);
    pulse = settle.next(0.3, 0.6);
  }

  const bob = chain(span(0.9, 0.5), 0.5, 0.5, 0.5, 0.5, 0.5).reduce(
    (m, sway, i) => m.to({ rotate: [5, -5, 5, -5, 5, 0][i]! }, sway, ease.inOut),
    motion({ rotate: 0 }),
  );

  const look = motion({ x: 0, y: 0 })
    .to({ x: 6, y: -5 }, span(0.5, 0.3))
    .to({ x: 0, y: 0 }, span(4.7, 0.3));

  const hops = jumps([{ land: 5.4, height: 50 }]);

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Watch the intro",
      desc: "The words watch the intro are handwritten while Blip, the svjeez mascot, plays projector: its antenna bulb flickers on, a beam lights a little screen with a pulsing play button, and Blip bobs along to the show.",
      reducedMotion: { at: 2 },
      css: cssTag`${cssTag.text(css)}${SQUASH}`,
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
            {blip({
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
