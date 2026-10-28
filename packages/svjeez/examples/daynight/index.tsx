import { type Color, draw, ease, enter, motion, render, sampled, wiggle } from "svjeez";
import { adaptive, base16 } from "svjeez/extras";
import { SCHEME_CSS, palette, random } from "../landing/kit";

// One palette, two schemes: warm paper by day, blue ink-black by night. Slots follow base16.
const { theme, css: themeCss } = adaptive({
  dark: base16("#14162A", "#1D2038", "#2D3150", "#6C7196", "#999EC0", "#C9CCE6", "#EEEFFA", "#FFFFFF", "#FF7A6E", "#FFA05C", "#FFD166", "#8FD19E", "#6FD0C8", "#7FA2FF", "#B79CFF", "#C98F6A"),
  light: base16("#FBF1DE", "#FFFBF2", "#E6D9BF", "#A39780", "#6E6450", "#3F382B", "#221D14", "#14100A", "#D9483B", "#E8772E", "#E0A21B", "#4F8A5B", "#2F8C88", "#3A5FC8", "#7E52C2", "#A66B43"),
});

// One lighthouse, one file. By day it is paper, sun and drifting cloud; by night it is ink, moon, stars and a turning beam.
// Nothing here checks the time: a media query inside the SVG picks the half of the scene that shows.
const W = 800;
const H = 500;
const D = 16;
const HORIZON = 330;

const { v, css: paletteCss } = palette({
  sky: ["#14162A", "#FBF1DE"],
  sea: ["#1F3A5C", "#9DCFCF"],
  wave: ["#4F7FA8", "#F4FBF8"],
  land: ["#2B2547", "#E9B97E"],
  house: ["#3A3060", "#FFFBF2"],
  roof: ["#FF7A6E", "#D9483B"],
  tower: ["#C9CCE6", "#FFFBF2"],
  band: ["#FF7A6E", "#D9483B"],
  glass: ["#FFD166", "#F6DFA4"],
  ink: ["#EEEFFA", "#3F382B"],
  sun: ["#FFD166", "#F5A623"],
  cloud: ["#2D3150", "#FFFFFF"],
});

const rand = random(7);
const stroke = { stroke: v.ink, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/** A filled shape that fades in, with its outline drawn over it. */
const Shape = ({ d, fill, at, over = 0.8 }: { d: string; fill: Color; at: number; over?: number }) => (
  <>
    <path d={d} fill={fill} animation={enter({ at: at + over * 0.5, over: 0.5 })} />
    <path d={d} {...stroke} animation={draw({ at, over })} />
  </>
);

const orbit = sampled(
  (t) => {
    const u = Math.min(1, Math.max(0, (t - 1.5) / (D - 3)));
    return { x: 110 + 420 * u, y: 250 - 170 * Math.sin(Math.PI * u) };
  },
  { duration: D, tolerance: { translate: 1 } },
);

const sparkle = "M0-7L1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z";
const stars = Array.from({ length: 16 }, () => ({ x: 30 + rand() * 740, y: 24 + rand() * 230, s: 0.5 + rand() * 0.7 }));

const wave = (x: number, y: number, phase: number) => (
  <path
    d={`M${x} ${y}q14-9 28 0t28 0t28 0t28 0`}
    {...stroke}
    stroke={v.wave}
    strokeWidth={2.2}
    animation={[enter({ at: 3.2 + phase * 0.2, over: 0.6 }), wiggle({ x: 7 }, { seed: `wave${phase}`, rate: 1.2, period: D / 4 })]}
  />
);

const boat = sampled(
  (t) => {
    const u = t / D;
    return { x: -150 + 330 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * u)), y: 2.5 * Math.sin(Math.PI * 2 * 4 * u), rotate: 2.5 * Math.sin(Math.PI * 2 * 4 * u + 1) };
  },
  { duration: D, tolerance: { translate: 0.4, rotate: 0.3 } },
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez: one lighthouse, day and night",
      desc: "A lighthouse on a headland draws itself in. In a light color scheme the sun crosses a pale sky past a drifting cloud. In a dark one a moon crosses a starry sky and the lantern sweeps its beam over the water. Both halves live in one SVG file and a media query picks which shows.",
      css: [themeCss, paletteCss, SCHEME_CSS].join("\n"),
      reducedMotion: { at: 9 },
    },
    <>
      <rect width={W} height={H} fill={v.sky} />
      <g animation={motion({ opacity: 1 }).at(D - 0.7).to({ opacity: 0 }, 0.6)}>
        <g class="night">
          {stars.map((star, i) => (
            <g transform={`translate(${star.x.toFixed(0)} ${star.y.toFixed(0)}) scale(${star.s.toFixed(2)})`}>
              <path d={sparkle} fill={theme.base0A} animation={[enter({ at: 0.4 + i * 0.1, over: 0.5 }, { scale: 0 }, ease.pop), i % 4 === 0 && wiggle({ opacity: 0.5 }, { seed: `star${i}`, rate: 1.5, period: D / 2 })]} />
            </g>
          ))}
        </g>
        <g class="night">
          <g animation={[enter({ at: 0.6, over: 0.8 }), orbit]}>
            <circle r={30} fill={theme.base0A} />
            <circle cx={13} cy={-8} r={26} fill={v.sky} />
          </g>
        </g>
        <g class="day">
          <g animation={[enter({ at: 0.6, over: 0.8 }), orbit]}>
            <circle r={30} fill={v.sun} />
            {Array.from({ length: 12 }, (_, i) => (
              <path d="M0-42V-54" stroke={v.sun} strokeWidth={4} strokeLinecap="round" transform={`rotate(${i * 30})`} />
            ))}
          </g>
          <g animation={[enter({ at: 1.4, over: 1 }), wiggle({ x: 18 }, { seed: "cloud", rate: 1, period: D / 2 })]}>
            <path d="M520 128a14 14 0 0 1 4-27a20 20 0 0 1 38-8a16 16 0 0 1 28 12a12 12 0 0 1-2 23Z" fill={v.cloud} stroke={v.ink} strokeWidth={2.5} strokeLinejoin="round" />
          </g>
          <g animation={[enter({ at: 1.8, over: 1 }), wiggle({ x: 14 }, { seed: "cloud2", rate: 1, period: D / 2 })]}>
            <path d="M120 196a11 11 0 0 1 3-21a15 15 0 0 1 29-6a12 12 0 0 1 21 9a9 9 0 0 1-2 18Z" fill={v.cloud} stroke={v.ink} strokeWidth={2.5} strokeLinejoin="round" />
          </g>
        </g>

        <rect y={HORIZON} width={W} height={H - HORIZON} fill={v.sea} animation={enter({ at: 0.2, over: 0.6 })} />
        <path d={`M0 ${HORIZON}H${W}`} {...stroke} animation={draw({ at: 0.2, over: 1 })} />
        {wave(70, 395, 0)}
        {wave(300, 372, 1)}
        {wave(520, 430, 2)}
        {wave(180, 455, 3)}

        <Shape d="M18 342C60 318 175 316 232 342Z" fill={v.land} at={1.2} />
        <Shape d="M440 500C440 410 510 342 600 330C680 320 740 332 800 322V500Z" fill={v.land} at={1.4} over={1.2} />

        <Shape d="M82 322V292H134V322Z" fill={v.house} at={2.2} over={0.6} />
        <Shape d="M74 292L108 262L142 292Z" fill={v.roof} at={2.6} over={0.5} />
        <path d="M100 322V304H116V322Z" {...stroke} fill={v.glass} animation={enter({ at: 3.1, over: 0.4 })} />
        <path d="M122 306H132V316H122Z" {...stroke} strokeWidth={2} fill={v.glass} animation={enter({ at: 3.2, over: 0.4 })} />

        <Shape d="M612 328L626 214H654L668 328Z" fill={v.tower} at={3.0} over={1.2} />
        <path d="M619.6 276H660.4L663.4 258H616.6Z" fill={v.band} animation={enter({ at: 4.2, over: 0.4 })} />
        <path d="M630 238H650L651.6 224H628.4Z" fill={v.band} animation={enter({ at: 4.3, over: 0.4 })} />
        <Shape d="M618 214H662V204H618Z" fill={v.tower} at={4.2} over={0.5} />
        <path d="M628 204V176H652V204Z" {...stroke} fill={v.glass} animation={enter({ at: 4.6, over: 0.4 })} />
        <Shape d="M622 176L640 154L658 176Z" fill={v.roof} at={4.7} over={0.5} />
        <path d="M640 154V142" {...stroke} animation={draw({ at: 5.1, over: 0.3 })} />

        <g class="night">
          <g animation={[enter({ at: 5.2, over: 0.6 }), motion({ opacity: 1 }).to({ opacity: 0.1 }, 2, ease.inOut).to({ opacity: 1 }, 2, ease.inOut).loop(4)]}>
            <path d="M628 190L360 150V230Z" fill={theme.base0A} opacity={0.22} />
          </g>
          <g animation={[enter({ at: 5.2, over: 0.6 }), motion({ opacity: 0.1 }).to({ opacity: 1 }, 2, ease.inOut).to({ opacity: 0.1 }, 2, ease.inOut).loop(4)]}>
            <path d="M652 190L800 150V230Z" fill={theme.base0A} opacity={0.22} />
          </g>
        </g>

        <g transform={`translate(${W / 2 - 150} 405)`}>
          <g animation={[enter({ at: 3.6, over: 0.6 }), boat]}>
            <path d="M-26 0H26L18 12H-18Z" fill={v.roof} stroke={v.ink} strokeWidth={2.2} strokeLinejoin="round" />
            <path d="M0 0V-34" {...stroke} strokeWidth={2.2} />
            <path d="M3-32L22-6H3Z" fill={v.tower} stroke={v.ink} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
      </g>
    </>,
  );
}
