import { def, draw, ease, motion, wiggle, type SvgNode } from "svg-motion";
import { C, D, T, envelope, glow, phased, pivot } from "./kit";

const SHADOW = 57;

const hot = glow(4, 2);
const cold = glow(5, 2);

const lensed = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#FFF4D6" />
    <stop offset={0.6} stopColor="#FFB25C" stopOpacity={0.7} />
    <stop offset={1} stopColor="#FF6A3D" stopOpacity={0} />
  </>
));

/** An elliptical arc over the top (`over`) or under the bottom of the shadow. */
const arch = (rx: number, ry: number, over: boolean): string =>
  `M${-rx} ${over ? 4 : -4}A${rx} ${ry} 0 0 ${over ? 1 : 0} ${rx} ${over ? 4 : -4}`;

/**
 * The shadow, its photon ring, and the far disk bent over the top by lensing. One group, so when we
 * fall in, the light it bends sweeps out past the edges of the screen with it.
 */
export function Shadow(): SvgNode {
  const life = motion({ scale: 0, opacity: 1 })
    .at(T.open)
    .to({ scale: 1 }, 0.9, ease.pop)
    .at(T.fall)
    .to({ scale: 13 }, 1.1, ease.in)
    .at(T.dawn)
    .to({ opacity: 0 }, 1, ease.inOut);
  return (
    <g style={pivot} animation={life}>
      <g fill="none" stroke={lensed} strokeLinecap="round" filter={hot}>
        <path d={arch(98, 90, true)} strokeWidth={16} opacity={0.35} animation={draw({ at: T.lens + 0.2, over: 1.2 })} />
        <path d={arch(76, 72, true)} strokeWidth={5} animation={draw({ at: T.lens, over: 0.9 })} />
        <path d={arch(70, 64, false)} strokeWidth={2.5} opacity={0.5} animation={draw({ at: T.lens + 0.4, over: 0.9 })} />
      </g>
      <circle r={SHADOW} fill="#000" />
      <g fill="none" stroke={C.white} filter={hot}>
        <circle r={SHADOW + 3} strokeWidth={2.2} transform="rotate(-90)" animation={draw({ at: T.lens, over: 0.8 }, ease.inOut)} />
        <circle r={SHADOW + 6} strokeWidth={0.8} opacity={0.5} transform="rotate(90)" animation={draw({ at: T.lens + 0.2, over: 0.8 }, ease.inOut)} />
      </g>
    </g>
  );
}

const beam = (dir: 1 | -1) =>
  def.linearGradient({ gradientUnits: "userSpaceOnUse", x1: 0, y1: dir * 58, x2: 0, y2: dir * 560 }, (
    <>
      <stop offset={0} stopColor="white" />
      <stop offset={0.3} stopColor={C.jet} stopOpacity={0.9} />
      <stop offset={1} stopColor={C.violet} stopOpacity={0} />
    </>
  ));

function Jet({ dir }: { dir: 1 | -1 }): SvgNode {
  const stroke = beam(dir);
  const length = dir * 560;
  return (
    <g fill="none" stroke={stroke} strokeLinecap="round">
      <path d={`M0 ${dir * 58}V${length}`} strokeWidth={14} opacity={0.18} />
      <path d={`M0 ${dir * 58}V${length}`} strokeWidth={2.4} animation={draw({ at: T.ignite, over: 0.35 })} />
      {Array.from({ length: 9 }, (_, k) => (
        <path
          d={`M0 0V${dir * 18}`}
          strokeWidth={1.6}
          stroke={C.white}
          animation={phased(0.6, (k * 0.6) / 9, (u) => ({ y: dir * (64 + 420 * u ** 1.4), opacity: Math.min(1, (1 - u) * 2) }), 6)}
        />
      ))}
    </g>
  );
}

/** Relativistic jets along the spin axis, perpendicular to the tilted disk. */
export function Jets(): SvgNode {
  return (
    <g filter={cold}>
      <g
        transform="rotate(-12)"
        animation={[envelope(T.ignite, T.collapse, 0.1), wiggle({ opacity: 0.3 }, { seed: "jet", rate: 18, ease: ease.hold, period: D / 8 })]}
      >
        <Jet dir={-1} />
        <Jet dir={1} />
      </g>
    </g>
  );
}
