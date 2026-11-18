import { Ink, Once, Pivot, css as cssTag, ease, motion, render, span, stagger } from "svjeez";
import { css, theme } from "../style";
import { lettering, marker } from "./cue";
import { BLIP, GROUND, SQUASH, blip, jumps } from "./lib/blip";

const W = 420;
const H = 148;
const D = 6;
const S = 0.38;
const HOME = { x: 120, y: 84 };
const DECK = { x: 270, y: 80 };

const PICTURES = [
  <>
    <circle cx={0} cy={-26} r={8} fill={BLIP.yellow} />
    <path d="M-12 -8H12" stroke={theme.base03} strokeWidth={2} strokeLinecap="round" />
  </>,
  <path
    d="M-13 -20Q-6 -32 0 -20T13 -20"
    fill="none"
    stroke={theme.base0D}
    strokeWidth={3}
    strokeLinecap="round"
  />,
  <>
    <rect x={-11} y={-22} width={5} height={14} rx={1.5} fill={theme.base0B} />
    <rect x={-3} y={-30} width={5} height={22} rx={1.5} fill={theme.base0B} />
    <rect x={5} y={-17} width={5} height={9} rx={1.5} fill={theme.base0B} />
  </>,
];

export default function build(): string {
  const strokes = lettering("browse examples");
  const fans = [-24, 0, 24];
  const dealt = stagger(span(0.5, 0.4), PICTURES.length, 0.25);

  const cards = PICTURES.map((picture, i) => {
    const fan = motion({ rotate: 0, x: 0 })
      .to({ rotate: fans[i]!, x: (i - 1) * 26 }, dealt[i]!, ease.pop)
      .to({ rotate: 0, x: 0 }, span(4.9, 0.45), ease.inOut);

    return (
      <Pivot origin={{ x: DECK.x, y: DECK.y }} animation={fan}>
        <g transform={`translate(${DECK.x} ${DECK.y})`}>
          <rect
            x={-20}
            y={-56}
            width={40}
            height={56}
            rx={6}
            fill={theme.base01}
            stroke={theme.base02}
            strokeWidth={1.5}
          />
          {picture}
        </g>
      </Pivot>
    );
  });

  const hops = jumps([
    { land: 2.2, height: 40 },
    { land: 3.5, height: 30 },
  ]);

  const look = motion({ x: 0, y: 0 })
    .to({ x: 6, y: -3 }, span(0.4, 0.3))
    .to({ x: 0, y: 0 }, span(4.8, 0.3));

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Browse examples",
      desc: "The words browse examples are handwritten while Blip, the svjeez mascot, fans out a hand of little picture cards and hops with delight.",
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
      {cards}
      <g
        transform={`translate(${HOME.x} ${HOME.y}) scale(${S}) translate(${-GROUND.x} ${-GROUND.y})`}
      >
        {blip({
          blinks: [1.4, 4.2],
          body: hops.body,
          stretch: hops.stretch,
          bulb: hops.bulb,
          look,
          feet: {},
        })}
      </g>
    </>,
  );
}
