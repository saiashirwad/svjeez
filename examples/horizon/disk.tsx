import { def, draw, ease, el, motion, type SvgNode } from "svjeez";
import { C, D, T, TILT, heat, phased, pivot, random } from "./kit";

const INNER = 78;
const OUTER = 330;
const RINGS = 22;

interface Ring {
  readonly r: number;
  readonly t: number;
  readonly width: number;
  readonly dash: string;
  readonly laps: number;
}

const rand = random(7);

const RING: readonly Ring[] = Array.from({ length: RINGS }, (_, i) => {
  const t = i / (RINGS - 1);
  const r = INNER + (OUTER - INNER) * t ** 1.25;
  const dash = Array.from({ length: 8 }, () => Math.round(6 + rand() * 70)).join(" ");
  return { r, t, width: 1.4 + rand() * 4.5 * (1 - t * 0.5), dash, laps: Math.max(1, Math.round(8 * (INNER / r) ** 1.5)) };
});

const far = def.clipPath({}, <rect x={-OUTER - 120} y={-OUTER - 120} width={2 * OUTER + 240} height={OUTER + 120} />);
const near = def.clipPath({}, <rect x={-OUTER - 120} y={0} width={2 * OUTER + 240} height={OUTER + 120} />);

const beam = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
  <>
    <stop offset={0} stopColor="white" />
    <stop offset={0.5} stopColor="#B8B8B8" />
    <stop offset={1} stopColor="#4A4A4A" />
  </>
));
const doppler = def.mask(
  { maskUnits: "userSpaceOnUse", x: -OUTER - 120, y: -OUTER - 120, width: 2 * OUTER + 240, height: 2 * OUTER + 240 },
  <rect x={-OUTER - 120} y={-OUTER - 120} width={2 * OUTER + 240} height={2 * OUTER + 240} fill={beam} />,
);

/**
 * The disk's glow, painted rather than filtered. A blur over the spinning rings re-runs every frame,
 * and Safari drops to about 10 fps under it; a still gradient costs nothing.
 */
const haze = def.radialGradient({}, (
  <>
    <stop offset={0.2} stopColor="#FFF1D0" stopOpacity={0.45} />
    <stop offset={0.4} stopColor="#FFB25C" stopOpacity={0.25} />
    <stop offset={0.7} stopColor="#C72E4F" stopOpacity={0.1} />
    <stop offset={1} stopColor="#4B1638" stopOpacity={0} />
  </>
));

const arrive = (t: number) => T.accrete + (1 - t) * 1.3;

const band = ({ r, t, width, dash, laps }: Ring): SvgNode[] => {
  const color = heat(t);
  const fade = 0.95 - t * 0.6;
  return [
    el.circle({
      r,
      fill: "none",
      stroke: color,
      strokeWidth: width * 0.6,
      opacity: fade * 0.45,
      animation: draw({ at: arrive(t), over: 1 }).at(T.black).set({ draw: 0 }),
    }),
    el.circle({
      r,
      fill: "none",
      stroke: color,
      strokeWidth: width,
      strokeDasharray: dash,
      strokeLinecap: "round",
      animation: [
        motion({ opacity: 0 }).at(arrive(t) + 0.3).to({ opacity: fade }, 0.9).at(T.black).set({ opacity: 0 }),
        motion({ rotate: 0 }).to({ rotate: 360 }, D / laps, ease.linear).loop(D / laps),
      ],
    }),
  ];
};

const DEBRIS = Array.from({ length: 34 }, (_, i) => ({
  r: OUTER + 20 + rand() * 90,
  angle: rand() * 360,
  period: D / (2 + (i % 3)),
  offset: rand() * D,
  size: 1.4 + rand() * 1.8,
}));

function Debris(): SvgNode {
  return (
    <g fill={C.white}>
      {DEBRIS.map(({ r, angle, period, offset, size }) => {
        const a = (angle * Math.PI) / 180;
        return el.circle({
          cx: Math.cos(a) * r,
          cy: Math.sin(a) * r,
          r: size,
          style: pivot,
          animation: phased(period, offset, (u) => ({
            rotate: 320 * u,
            scale: 1 - 0.8 * u * u,
            opacity: Math.min(1, u * 6, (1 - u) * 5),
          })),
        });
      })}
    </g>
  );
}

const swallow = motion({ opacity: 1, scale: 1, rotate: 0 })
  .at(T.collapse)
  .to({ opacity: 0, scale: 0.25, rotate: 160 }, 0.9, ease.in)
  .at(T.dawn)
  .set({ scale: 1, rotate: 0 })
  .to({ opacity: 1 }, 1);

export function Disk({ half }: { half: "far" | "near" }): SvgNode {
  return (
    <g transform={TILT}>
      <g clipPath={half === "far" ? far : near} mask={doppler}>
        <g animation={swallow}>
          {RING.map(band)}
        </g>
      </g>
    </g>
  );
}

export function Aura(): SvgNode {
  return (
    <g transform={TILT}>
      <g animation={swallow}>
        <circle
          r={OUTER + 40}
          fill={haze}
          mask={doppler}
          animation={motion({ opacity: 0 }).at(T.accrete + 0.4).to({ opacity: 1 }, 1.6).at(T.black).set({ opacity: 0 })}
        />
        <Debris />
      </g>
    </g>
  );
}

export function Shock(): SvgNode {
  const burst = (scale: number, over: number) =>
    motion({ scale: 1, opacity: 0 })
      .at(T.ignite)
      .to({ scale }, over, ease.out)
      .at(T.ignite)
      .to({ opacity: 1 }, 0.05)
      .to({ opacity: 0 }, over - 0.05, ease.out);
  return (
    <g fill="none" stroke={C.white}>
      <g transform={TILT}>
        <circle r={80} strokeWidth={2} animation={burst(5.5, 1.4)} />
      </g>
      <circle r={62} strokeWidth={0.8} animation={burst(9, 1.1)} />
    </g>
  );
}
