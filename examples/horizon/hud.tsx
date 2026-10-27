import { def, draw, ease, el, enter, motion, wiggle, type SvgNode } from "svjeez";
import { C, D, H, T, W, envelope, on } from "./kit";

/** `.mono` is 10px, and every monospace face here advances 0.6em. */
const ADVANCE = 6;
const LINE = 14;

function Typed({ x, y, text, at, dim = false }: { x: number; y: number; text: string; at: number; dim?: boolean }): SvgNode {
  return (
    <g class="mono" fill={dim ? C.hudDim : C.hud}>
      {[...text].map((char, i) => (char === " " ? null : el.text({ x: x + i * ADVANCE, y, animation: on(at + i * 0.022) }, char)))}
    </g>
  );
}

function Wheel({ x, y, labels, period }: { x: number; y: number; labels: readonly string[]; period: number }): SvgNode {
  const width = labels[0]!.length * ADVANCE;
  const window = def.clipPath({}, el.rect({ x, y: y - LINE + 3, width, height: LINE }));
  const count = labels.length;
  return el.g(
    { clipPath: window },
    el.g(
      { animation: motion({ y: 0 }).to({ y: -count * LINE }, period, ease.steps(count)).loop(period) },
      [...labels, labels[0]!].map((label, k) => el.text({ x, y: y + k * LINE }, label)),
    ),
  );
}

const digits = (count: number, pad = 1) => Array.from({ length: count }, (_, k) => String(k).padStart(pad, "0"));

function Clock({ x, y }: { x: number; y: number }): SvgNode {
  return el.g({ class: "mono", fill: C.white }, [
    el.text({ x, y }, "T+"),
    <Wheel x={x + 3 * ADVANCE} y={y} labels={digits(D, 2)} period={D} />,
    el.text({ x: x + 5 * ADVANCE, y }, "."),
    <Wheel x={x + 6 * ADVANCE} y={y} labels={digits(10)} period={1} />,
    <Wheel x={x + 7 * ADVANCE} y={y} labels={digits(10)} period={0.1} />,
    el.text({ x: x + 8 * ADVANCE, y, fill: C.hudDim }, "s"),
  ]);
}

function Flux({ x, y }: { x: number; y: number }): SvgNode {
  const bars = 24;
  const window = def.clipPath({}, el.rect({ x, y: y - 28, width: bars * 5, height: 28 }));
  return (
    <>
      <Typed x={x} y={y - 36} text="HAWKING FLUX" at={T.hud + 0.6} dim />
      <g clipPath={window} fill={C.hud}>
        {Array.from({ length: bars }, (_, i) =>
          el.rect({
            x: x + i * 5,
            y: y - 14,
            width: 3,
            height: 40,
            animation: wiggle({ y: 13 }, { seed: `flux-${i}`, rate: 9, ease: ease.hold, period: D / 4 }),
          }),
        )}
      </g>
    </>
  );
}

function Brackets(): SvgNode {
  const inset = 22;
  const arm = 26;
  const corners = [
    `M${inset} ${inset + arm}V${inset}H${inset + arm}`,
    `M${W - inset - arm} ${inset}H${W - inset}V${inset + arm}`,
    `M${W - inset} ${H - inset - arm}V${H - inset}H${W - inset - arm}`,
    `M${inset + arm} ${H - inset}H${inset}V${H - inset - arm}`,
  ];
  return (
    <g fill="none" stroke={C.hud} strokeWidth={1.2}>
      {corners.map((d, i) => el.path({ d, animation: draw({ at: T.hud + i * 0.06, over: 0.4 }) }))}
    </g>
  );
}

function Scan(): SvgNode {
  const sweep = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
    <>
      <stop offset={0} stopColor={C.hud} stopOpacity={0} />
      <stop offset={0.5} stopColor={C.hud} stopOpacity={0.8} />
      <stop offset={1} stopColor={C.hud} stopOpacity={0} />
    </>
  ));
  return (
    <rect
      width={W}
      height={1.5}
      fill={sweep}
      animation={motion({ y: 0, opacity: 0 })
        .at(T.hud - 0.1)
        .to({ y: H }, 0.8, ease.inOut)
        .at(T.hud - 0.1)
        .to({ opacity: 1 }, 0.1)
        .at(T.hud + 0.55)
        .to({ opacity: 0 }, 0.15)}
    />
  );
}

export function Hud(): SvgNode {
  return (
    <g animation={envelope(T.hud, T.collapse, 0.3)}>
      <Scan />
      <Brackets />
      <Typed x={44} y={50} text="SGR A* // EVENT HORIZON ARRAY" at={T.hud + 0.2} />
      <Typed x={44} y={50 + LINE} text="OBS 2026.10.23  230 GHZ  LOCK" at={T.hud + 0.5} dim />
      <Typed x={W - 44 - 18 * ADVANCE} y={50} text="MASS  4.297E6 MSUN" at={T.hud + 0.3} dim />
      <Typed x={W - 44 - 18 * ADVANCE} y={50 + LINE} text="SPIN  A* = 0.998" at={T.hud + 0.45} dim />
      <Clock x={W - 44 - 18 * ADVANCE} y={50 + 2 * LINE} />
      <Typed x={44} y={H - 44} text="R_S  1.27E7 KM" at={T.hud + 0.7} dim />
      <Flux x={W - 44 - 24 * 5} y={H - 44} />
    </g>
  );
}

export function Reticle(): SvgNode {
  const ticks = [0, 90, 180, 270].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `M${Math.cos(a) * 160} ${Math.sin(a) * 160}L${Math.cos(a) * 172} ${Math.sin(a) * 172}`;
  });
  const arc = (from: number, to: number, r: number) => {
    const p = (deg: number) => `${(Math.cos((deg * Math.PI) / 180) * r).toFixed(2)} ${(Math.sin((deg * Math.PI) / 180) * r).toFixed(2)}`;
    return `M${p(from)}A${r} ${r} 0 0 1 ${p(to)}`;
  };
  return (
    <g fill="none" stroke={C.hud} animation={envelope(T.hud + 0.3, T.collapse - 0.2, 0.4)}>
      <circle r={150} strokeWidth={1} strokeDasharray="1 5" opacity={0.5} animation={motion({ rotate: 0 }).to({ rotate: 90 }, D, ease.linear)} />
      <circle r={190} strokeWidth={0.6} strokeDasharray="40 8 2 8" opacity={0.3} animation={motion({ rotate: 0 }).to({ rotate: -60 }, D, ease.linear)} />
      {ticks.map((d, i) => el.path({ d, strokeWidth: 1.2, animation: draw({ at: T.hud + 0.4 + i * 0.08, over: 0.3 }) }))}
      <path d={arc(-40, 40, 178)} strokeWidth={1.4} animation={draw({ at: T.hud + 0.6, over: 0.6 }, ease.inOut)} />
      <path d={arc(140, 220, 178)} strokeWidth={1.4} animation={draw({ at: T.hud + 0.6, over: 0.6 }, ease.inOut)} />
    </g>
  );
}

export function Title(): SvgNode {
  const word = "EVENT HORIZON";
  const pitch = 30;
  const left = W / 2 - ((word.length - 1) * pitch) / 2;
  const middle = (word.length - 1) / 2;
  return (
    <>
      {[...word].map((letter, i) => {
        const spread = Math.abs(i - middle) * 0.07;
        return letter === " "
          ? null
          : el.text(
              {
                x: left + i * pitch,
                y: H - 72,
                class: "sans",
                fontSize: 30,
                fontWeight: 200,
                fill: C.white,
                textAnchor: "middle",
                animation: enter({ at: T.title + spread, over: 1.1 }, { opacity: 0, blur: 12, y: 10 })
                  .at(T.collapse - 0.3 + spread / 2)
                  .to({ opacity: 0, blur: 14, y: -6 }, 0.6, ease.in),
              },
              letter,
            );
      })}
      <g animation={envelope(T.title + 0.8, T.collapse - 0.2, 0.6)}>
        <text x={W / 2} y={H - 46} class="mono" letterSpacing={6} fill={C.hudDim} textAnchor="middle">
          THE POINT OF NO RETURN
        </text>
      </g>
    </>
  );
}

export function Flash(): SvgNode {
  return (
    <rect
      width={W}
      height={H}
      fill={C.white}
      animation={motion({ opacity: 0 }).at(T.ignite).to({ opacity: 0.3 }, 0.04).to({ opacity: 0 }, 0.6)}
    />
  );
}

const lines = def.pattern({ width: 4, height: 3, patternUnits: "userSpaceOnUse" }, <rect width={4} height={1} fill="#000" opacity={0.18} />);
const vignette = def.radialGradient({ cx: 0.5, cy: 0.5, r: 0.75 }, (
  <>
    <stop offset={0.55} stopColor="#000" stopOpacity={0} />
    <stop offset={1} stopColor="#000" stopOpacity={0.7} />
  </>
));

export function Lens(): SvgNode {
  return (
    <>
      <rect width={W} height={H} fill={lines} />
      <rect width={W} height={H} fill={vignette} />
    </>
  );
}
