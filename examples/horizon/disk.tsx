import { def, draw, ease, motion, type SvgNode } from "svg-motion";
import { C, D, T, TILT, glow, heat, phased, pivot, random } from "./kit";

const INNER = 78;
const OUTER = 330;
const RINGS = 22;

interface Ring {
  readonly r: number;
  readonly t: number;
  readonly width: number;
  readonly dash: string;
  /** Turns per scene. Keplerian: the inner edge laps the rim about eight times. */
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

/** Doppler beaming: the side rushing toward us is brighter. */
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

const warm = glow(6, 2, { x: 370, y: 160 });

/** Matter forms the disk outside-in and is swallowed with it. */
const arrive = (t: number) => T.accrete + (1 - t) * 1.3;

function Band({ ring }: { ring: Ring }): SvgNode {
  const { r, t, width, dash, laps } = ring;
  const color = heat(t);
  const fade = 0.95 - t * 0.6;
  return (
    <>
      <circle
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width * 0.6}
        opacity={fade * 0.45}
        animation={draw({ at: arrive(t), over: 1 }).at(T.black).set({ draw: 0 })}
      />
      <circle
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        animation={[
          motion({ opacity: 0 }).at(arrive(t) + 0.3).to({ opacity: fade }, 0.9).at(T.black).set({ opacity: 0 }),
          motion({ rotate: 0 }).to({ rotate: 360 }, D / laps, ease.linear).loop(D / laps),
        ]}
      />
    </>
  );
}

const DEBRIS = Array.from({ length: 34 }, (_, i) => ({
  r: OUTER + 20 + rand() * 90,
  angle: rand() * 360,
  period: D / (2 + (i % 3)),
  offset: rand() * D,
  size: 1.4 + rand() * 1.8,
}));

/** Stray matter spiralling in, out of step with itself. */
function Debris(): SvgNode {
  return (
    <g fill={C.white}>
      {DEBRIS.map(({ r, angle, period, offset, size }) => {
        const a = (angle * Math.PI) / 180;
        return (
          <circle
            cx={Math.cos(a) * r}
            cy={Math.sin(a) * r}
            r={size}
            style={pivot}
            animation={phased(period, offset, (u) => ({
              rotate: 320 * u,
              scale: 1 - 0.8 * u * u,
              opacity: Math.min(1, u * 6, (1 - u) * 5),
            }))}
          />
        );
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

/** Half the disk: the far half goes behind the shadow, the near half in front of it. */
export function Disk({ half }: { half: "far" | "near" }): SvgNode {
  return (
    <g filter={warm}>
      <g transform={TILT}>
        <g clipPath={half === "far" ? far : near} mask={doppler}>
          <g animation={swallow}>
            {RING.map((ring) => (
              <Band ring={ring} />
            ))}
            <Debris />
          </g>
        </g>
      </g>
    </g>
  );
}

/** The ignition shockwave, riding out along the disk plane and across the screen. */
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
