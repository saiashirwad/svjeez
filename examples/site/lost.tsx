import { def, ease, motion, render } from "svjeez";
import { CSS, chrome, random } from "./kit";
import { CHICK, chick } from "./lib/chick";
import { theme } from "../style";

// The 404 page: the chick hops along a timeline behind its playhead. The track ends, the chick skids to a stop at the
// edge, and the playhead sails on into the empty space past it. The chick looks around, lights its antenna bulb like a
// flashlight, and finds the playhead out in the dark, parked at 404s. `tall` is the same story on a shorter track.

const D = 10;
const BAR = 40;

// Beats, in seconds.
const WALK = { at: 0.4, over: 3.6 };
const STOP = WALK.at + WALK.over;
const LIGHT = 6;
const FOUND = 6.6;
const DARK = 8.6;

const HOPS = 8;

interface Stage {
  readonly width: number;
  readonly height: number;
  /** The first tick, the gap between ticks, and how many seconds the track holds. */
  readonly x0: number;
  readonly gap: number;
  readonly seconds: number;
  /** Where the playhead ends up, out past the track. */
  readonly lost: number;
  readonly scale: number;
  readonly fontSize: number;
}

const WIDE: Stage = {
  width: 1056,
  height: 432,
  x0: 150,
  gap: 80,
  seconds: 6,
  lost: 930,
  scale: 0.8,
  fontSize: 13,
};

const TALL: Stage = {
  width: 358,
  height: 320,
  x0: 82,
  gap: 44,
  seconds: 3,
  lost: 312,
  scale: 0.5,
  fontSize: 11,
};

export const make = (tall = false): string => {
  const { width: W, height: H, x0, gap, seconds, lost, scale: s, fontSize } = tall ? TALL : WIDE;
  const y = Math.round(BAR + (H - BAR) * 0.63);
  const x1 = x0 + gap * seconds;

  // The chick starts behind the 0s tick and stops with its toes over the end of the track.
  const start = x0 - 66 * s - 6;
  const stop = x1 - 50 * s;
  const bulb = { x: stop, y: y + (38 - 162) * s };

  const walk = motion({ x: 0 })
    .at(WALK.at)
    .to({ x: stop - start }, WALK.over, ease.linear);

  const hop = WALK.over / HOPS;
  let hops = motion({ y: 0 }).at(WALK.at);
  for (let i = 0; i < HOPS; i++)
    hops = hops.to({ y: -10 }, hop / 2, ease.out).to({ y: 0 }, hop / 2, ease.in);
  hops = hops
    .at(FOUND + 0.15)
    .to({ y: -14 }, 0.16, ease.out)
    .to({ y: 0 }, 0.18, ease.in);

  // A lean forward as it brakes, then upright.
  const brake = motion({ rotate: 0 })
    .at(STOP)
    .to({ rotate: 12 }, 0.12, ease.out)
    .to({ rotate: 0 }, 0.6, ease.pop);

  const look = motion({ x: 0 })
    .at(4.7)
    .to({ x: 5 }, 0.2)
    .wait(0.4)
    .to({ x: -5 }, 0.3)
    .wait(0.4)
    .to({ x: 5 }, 0.25)
    .at(DARK + 0.3)
    .to({ x: 0 }, 0.3);

  const wobble = motion({ y: 0 })
    .at(FOUND + 0.15)
    .to({ y: 3 }, 0.12)
    .to({ y: -2 }, 0.18, ease.inOut)
    .to({ y: 3 }, 0.1, ease.in)
    .to({ y: 0 }, 0.4, ease.pop);

  const glow = motion({ fill: CHICK.yellow })
    .at(LIGHT)
    .to({ fill: "#FFF6C2" }, 0.2)
    .at(DARK)
    .to({ fill: CHICK.yellow }, 0.4);

  // The playhead keeps going past the end, slows, and fades into the dark until the beam finds it.
  const playhead = motion({ x: 0 })
    .at(WALK.at)
    .to({ x: x1 - x0 }, WALK.over, ease.linear)
    .to({ x: lost - x0 }, 1.6, ease.out);

  const dim = motion({ opacity: 1 })
    .at(STOP)
    .to({ opacity: 0.18 }, 1)
    .at(FOUND)
    .to({ opacity: 1 }, 0.3);

  const found = motion({ opacity: 0.18 }).at(FOUND).to({ opacity: 1 }, 0.3);

  // The beam is drawn along +x from the bulb and sweeps down onto the playhead. A mirrored copy with no paint makes the
  // group's box centered on the bulb, so it turns about the bulb. It reaches past the playhead but stops short of the
  // window's right edge.
  const target = { x: lost, y: y - 30 };
  const angle = (Math.atan2(target.y - bulb.y, target.x - bulb.x) * 180) / Math.PI;
  const L = Math.round(
    Math.min(Math.hypot(target.x - bulb.x, target.y - bulb.y) + 50, W - 16 - bulb.x),
  );
  const [cos, sin] = [Math.cos(0.17), Math.sin(0.17)].map((n) => +(n * L).toFixed(1));
  const wedge = (dir: 1 | -1) =>
    `M0 0L${dir * cos!} ${-sin!}A${L} ${L} 0 0 ${dir > 0 ? 1 : 0} ${dir * cos!} ${sin!}Z`;

  const light = def.linearGradient(
    { x1: 0, y1: 0, x2: 1, y2: 0 },
    <>
      <stop offset={0} stopColor="#FFE066" stopOpacity={0.6} />
      <stop offset={1} stopColor="#FFE066" stopOpacity={0.12} />
    </>,
  );

  const sweep = motion({ rotate: -22, opacity: 0 })
    .at(LIGHT)
    .to({ opacity: 1 }, 0.2)
    .to({ rotate: 0 }, FOUND - LIGHT - 0.2, ease.inOut)
    .at(DARK)
    .to({ opacity: 0 }, 0.4);

  const rnd = random(404);
  const specks = Array.from({ length: tall ? 7 : 16 }, () => ({
    x: x1 + 30 + rnd() * (W - x1 - 60),
    y: BAR + 24 + rnd() * (y - BAR - 70),
    r: 1.2 + rnd() * 1.4,
  }));

  const mark = (glyph: string, at: number, over: number) => (
    <text
      x={stop - 46 * s}
      y={bulb.y - 4}
      class="round"
      fontSize={fontSize * 1.8}
      fontWeight={700}
      textAnchor="middle"
      fill={theme.base0D}
      animation={motion({ opacity: 0, scale: 0 })
        .at(at)
        .to({ opacity: 1, scale: 1 }, 0.35, ease.pop)
        .at(at + over - 0.2)
        .to({ opacity: 0 }, 0.2)}
    >
      {glyph}
    </text>
  );

  const fade = motion({ opacity: 0 })
    .to({ opacity: 1 }, 0.3)
    .at(D - 0.5)
    .to({ opacity: 0 }, 0.5);

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "404: not on the timeline",
      desc: `The svjeez chick hops along a timeline behind its playhead. The track ends at ${seconds}s and the chick skids to a stop, but the playhead sails on into the dark. The chick looks around, lights its antenna bulb like a flashlight and finds the playhead parked far away at 404s.`,
      css: CSS,
      reducedMotion: { at: FOUND + 0.9 },
    },
    <>
      {chrome(W, H, "404.tsx", { bar: BAR }).node}
      <g animation={fade}>
        {specks.map((p) => (
          <circle cx={p.x} cy={p.y} r={p.r} fill={theme.base03} opacity={0.5} />
        ))}
        <path
          d={`M${x1 + 14} ${y}H${W - 24}`}
          stroke={theme.base02}
          strokeWidth={2}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <path
          d={`M${x0 - 12} ${y}H${x1}`}
          stroke={theme.base03}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d={`M${x1} ${y - 9}V${y + 9}`}
          stroke={theme.base03}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <g class="round" fontSize={fontSize} fill={theme.base03}>
          {Array.from({ length: seconds + 1 }, (_, i) => (
            <>
              <path
                d={`M${x0 + i * gap} ${y + 6}V${y + 12}`}
                stroke={theme.base03}
                strokeWidth={1.5}
              />
              <text x={x0 + i * gap} y={y + 28} textAnchor="middle">
                {i}s
              </text>
            </>
          ))}
          <g animation={found}>
            <path d={`M${lost} ${y + 6}V${y + 12}`} stroke={theme.base09} strokeWidth={1.5} />
            <text x={lost} y={y + 28} textAnchor="middle" fill={theme.base09} fontWeight={700}>
              404s
            </text>
          </g>
        </g>
        <g transform={`translate(${bulb.x} ${bulb.y}) rotate(${angle.toFixed(1)})`}>
          <g animation={sweep}>
            <path d={wedge(1)} fill={light} />
            <path d={wedge(-1)} fill="none" />
          </g>
        </g>
        <g animation={[playhead, dim]}>
          <path d={`M${x0} ${y - 30}V${y + 12}`} stroke={theme.base06} strokeWidth={2} />
          <circle cx={x0} cy={y - 30} r={5} fill={theme.base06} />
        </g>
        <g animation={[walk, hops]}>
          <g transform={`translate(${start} ${y - 1.5}) scale(${s}) translate(-104 -162)`}>
            {chick({ blinks: [5.55, 7.6], body: brake, look, bulb: wobble, glow })}
          </g>
        </g>
        {mark("?", 4.9, 1)}
        {mark("!", FOUND + 0.1, 1.6)}
      </g>
    </>,
  );
};

export default () => make();
