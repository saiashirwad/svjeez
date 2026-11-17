import { ease, enter, motion, render, Marker, code, span } from "svjeez";

import { highlight } from "@svjeez/code";
import { CSS, chrome, outro } from "./lib/kit";
import { GROUND, blip } from "./lib/blip";
import { mono, theme } from "../style";

const BAR = 40;

const shown = `const pop = span(0.5, 0.6);
const tilt = pop.next(0.5, 1.5);
motion({ opacity: 0, y: 40 })
  .to({ opacity: 1, y: 0 }, pop, ease.pop)
  .to({ scale: 1.4, rotate: -12 }, tilt)
  .to({ scale: 1, rotate: 0 }, tilt.next(0.4))`;

const obey = (t0: number) => {
  const pop = span(t0 + 0.5, 0.6);
  const tilt = pop.next(0.5, 1.5);

  return motion({ opacity: 0, y: 40 })
    .to({ opacity: 1, y: 0 }, pop, ease.pop)
    .to({ scale: 1.4, rotate: -12 }, tilt)
    .to({ scale: 1, rotate: 0 }, tilt.next(0.4));
};

export const make = (tall = false): string => {
  const W = tall ? 358 : 1032;
  const H = tall ? 504 : 420;
  const SPLIT = 452;
  const win = chrome(W, H, "motion.ts");

  const src = code(
    highlight(shown, "tsx"),
    tall
      ? { theme, font: mono, fontSize: 11.5, lineHeight: 2, x: 20, y: BAR + 18 }
      : { theme, font: mono, fontSize: 14, lineHeight: 1.9, x: 28, y: BAR + 28 },
  );

  const panel = tall
    ? { x: 20, y: 214, w: 318, h: 96 }
    : { x: SPLIT + 24, y: BAR + 22, w: W - SPLIT - 48, h: 132 };

  const labelY = tall ? 342 : BAR + 186;
  const lineTop = labelY + 6;
  const rowY0 = lineTop + 4;
  const gap = tall ? 36 : 40;
  const T0 = 0.9;

  const lit = [
    { show: { at: T0 + 0.5, over: 0.6 }, target: src.lines(4, 4).pad(6) },
    { show: { at: T0 + 1.1, over: 1.5 }, target: src.lines(2, 2).pad(6) },
    { show: { at: T0 + 2.6, over: 0.5 }, target: src.lines(5, 5).pad(6) },
    { show: { at: T0 + 3.1, over: 0.4 }, target: src.lines(6, 6).pad(6) },
  ];

  const D = Math.ceil(T0 + 3.5 + 2.2);

  const AXIS = tall
    ? { x: 76, w: 258, span: 4 }
    : { x: SPLIT + 96, w: W - SPLIT - 96 - 36, span: 4 };

  const px = (t: number) => AXIS.x + (t / AXIS.span) * AXIS.w;

  const ROWS = [
    { name: "opacity", color: theme.base0D, bars: [[0.5, 1.1]] },
    { name: "y", color: theme.base0D, bars: [[0.5, 1.1]] },
    {
      name: "scale",
      color: theme.base0E,
      bars: [
        [2.6, 3.1],
        [3.1, 3.5],
      ],
    },
    {
      name: "rotate",
      color: theme.base09,
      bars: [
        [2.6, 3.1],
        [3.1, 3.5],
      ],
    },
  ] as const;

  const rowY = (i: number) => rowY0 + i * gap;

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Motions on a timeline",
      desc: "A motion chain types out. Beside it the same chain is drawn as one track per channel, a playhead sweeps across them, and Blip fades in, drops into place, grows and tilts its head exactly as the chain says.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <path d={tall ? `M0 ${BAR + 172}H${W}` : `M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.1, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
        <Marker stops={lit} color={theme.base0D} />
      </g>
      <g animation={outro(D)}>
        <rect
          x={panel.x}
          y={panel.y}
          width={panel.w}
          height={panel.h}
          rx={10}
          fill={theme.base01}
        />
        <g animation={obey(T0)}>
          <g
            transform={`translate(${panel.x + panel.w / 2} ${panel.y + panel.h / 2 + 34}) scale(0.48) translate(${-GROUND.x} ${-GROUND.y})`}
          >
            {blip({ blinks: [T0 + 1.6, T0 + 3.7], feet: {} })}
          </g>
        </g>
        <g class="round" fontSize={11} fill={theme.base03}>
          {[0, 1, 2, 3, 4].map((s) => (
            <g>
              <text x={px(s)} y={labelY} textAnchor="middle">
                {s}s
              </text>
              <path
                d={`M${px(s)} ${lineTop}V${rowY(3) + 24}`}
                stroke={theme.base02}
                strokeDasharray="2 4"
              />
            </g>
          ))}
        </g>
        {ROWS.map((row, i) => (
          <g>
            <text
              x={tall ? 24 : SPLIT + 28}
              y={rowY(i) + 14}
              class="sans"
              fontSize={12}
              fill={theme.base04}
            >
              {row.name}
            </text>
            {row.bars.map(([a, b]) => (
              <>
                <rect
                  x={px(a)}
                  y={rowY(i) + 2}
                  width={px(b) - px(a)}
                  height={16}
                  rx={8}
                  fill={theme.base02}
                />
                <rect
                  x={px(a)}
                  y={rowY(i) + 2}
                  width={0}
                  height={16}
                  rx={8}
                  fill={row.color}
                  animation={motion({ width: 0 }).to(
                    { width: px(b) - px(a) },
                    span(T0 + a).until(T0 + b),
                    ease.linear,
                  )}
                />
              </>
            ))}
          </g>
        ))}
        <g
          animation={motion({ x: 0 }).to(
            { x: AXIS.w * (3.5 / AXIS.span) },
            span(T0, 3.5),
            ease.linear,
          )}
        >
          <path
            d={`M${AXIS.x} ${lineTop}V${rowY(3) + 24}`}
            stroke={theme.base06}
            strokeWidth={1.5}
          />
          <circle cx={AXIS.x} cy={lineTop} r={4} fill={theme.base06} />
        </g>
      </g>
    </>,
  );
};

export default () => make();
