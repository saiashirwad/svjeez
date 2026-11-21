import {
  Group,
  Shape,
  circle,
  ease,
  ellipse,
  linear,
  mix,
  path,
  polygon,
  radial,
  rect,
  sampled,
  scene,
  span,
  track,
  type Geometry,
  type SceneElement,
  type Track,
  type Vec,
} from "svjeez";

// Bioluminescent jellyfish drifting through an abyssal pelagic column.
// Every bell contraction, scalloped margin, ruffled oral arm, and trailing tentacle
// is solved analytically as a traveling fluid wave and lowered via sampled() geometry.

type Hex = `#${string}`;

const WIDTH = 960;
const HEIGHT = 540;
const SECONDS = 8;
const CYCLE = 4; // propulsion cycle period (divides SECONDS = 8 cleanly)
const TAU = Math.PI * 2;

const rnd = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const q = (v: number): number => Math.round(v * 10) / 10;

// Smooth open Catmull-Rom cubic curve through control points (constant curve count for sampled())
const smoothOpen = (pts: readonly Vec[]): Geometry => {
  let p = path().moveTo([q(pts[0]![0]), q(pts[0]![1])]);

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1: Vec = [q(p1[0] + (p2[0] - p0[0]) / 6), q(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: Vec = [q(p2[0] - (p3[0] - p1[0]) / 6), q(p2[1] - (p3[1] - p1[1]) / 6)];

    p = p.curveTo(c1, c2, [q(p2[0]), q(p2[1])]);
  }

  return p;
};

// --- fluid propulsion kinematics --------------------------------------------

// Asymmetric contraction waveform: brisk power stroke, languid recovery coast (periodic in [0, 1))
const pulseOf = (u: number): number => {
  const a = u * TAU;

  return Math.sin(a) + 0.24 * Math.sin(2 * a - 0.55);
};

// Vertical swimming surge (phase-lagged behind contraction as the shed vortex pushes the bell)
const surgeOf = (u: number): number =>
  -Math.cos(u * TAU - 0.85) - 0.16 * Math.cos(2 * u * TAU - 1.4);

// Scalloped bell silhouette: outer dome + 6 gentle marginal lappets, conserving volume as it pulses
const bellGeometry = (u: number, rxBase: number, ryBase: number): Geometry => {
  const p = pulseOf(u);
  const rimLag = pulseOf(u - 0.08);

  const rx = rxBase * (1 - 0.16 * p);
  const crownY = -ryBase * (1 + 0.13 * p);
  const waistX = rx * (1.06 - 0.05 * p);
  const waistY = -ryBase * 0.28;
  const rimX = rx * (0.98 - 0.1 * rimLag);
  const rimY = ryBase * (0.14 + 0.1 * rimLag);

  // Build outer dome from left rim over apex to right rim, then 6 scallops back to left rim
  let g = path()
    .moveTo([q(-rimX), q(rimY)])
    .curveTo([q(-waistX * 1.06), q(waistY)], [q(-rx * 0.62), q(crownY)], [0, q(crownY)])
    .curveTo([q(rx * 0.62), q(crownY)], [q(waistX * 1.06), q(waistY)], [q(rimX), q(rimY)]);

  const lobes = 6;
  const scallopDepth = ryBase * (0.12 + 0.03 * rimLag);

  for (let i = 0; i < lobes; i++) {
    const f0 = 1 - (2 * i) / lobes;
    const f1 = 1 - (2 * (i + 1)) / lobes;
    const x0 = rimX * f0;
    const x1 = rimX * f1;
    const midX = (x0 + x1) / 2;
    const arch0 = Math.sqrt(Math.max(0, 1 - f0 * f0)) * ryBase * 0.1;
    const arch1 = Math.sqrt(Math.max(0, 1 - f1 * f1)) * ryBase * 0.1;
    const yEnd = rimY + arch1;
    const yDip = rimY + (arch0 + arch1) / 2 + scallopDepth;

    g = g.quadTo([q(midX), q(yDip)], [q(x1), q(yEnd)]);
  }

  return g.close();
};

// Inner translucent subumbrella dome (sits softly inside the outer gelatinous bell)
const innerBellGeometry = (u: number, rxBase: number, ryBase: number): Geometry => {
  const p = pulseOf(u);
  const rx = rxBase * 0.78 * (1 - 0.15 * p);
  const crownY = -ryBase * 0.8 * (1 + 0.12 * p);
  const rimY = ryBase * (0.08 + 0.08 * p);

  return path()
    .moveTo([q(-rx), q(rimY)])
    .curveTo([q(-rx * 1.05), q(-ryBase * 0.25)], [q(-rx * 0.56), q(crownY)], [0, q(crownY)])
    .curveTo([q(rx * 0.56), q(crownY)], [q(rx * 1.05), q(-ryBase * 0.25)], [q(rx), q(rimY)])
    .quadTo([0, q(rimY - ryBase * 0.16)], [q(-rx), q(rimY)])
    .close();
};

// Specular fresnel rim highlight arching across the upper-left gelatinous dome
const highlightGeometry = (u: number, rxBase: number, ryBase: number): Geometry => {
  const p = pulseOf(u);
  const rx = rxBase * (1 - 0.16 * p);
  const crownY = -ryBase * (1 + 0.13 * p);

  return path()
    .moveTo([q(-rx * 0.78), q(-ryBase * 0.22)])
    .curveTo(
      [q(-rx * 0.68), q(crownY * 0.78)],
      [q(-rx * 0.28), q(crownY * 0.94)],
      [q(rx * 0.14), q(crownY * 0.9)],
    );
};

// Radial meridian rib running from apex to margin (used for bioluminescent nerve pulses)
const meridianGeometry = (u: number, frac: number, rxBase: number, ryBase: number): Geometry => {
  const p = pulseOf(u);
  const rimLag = pulseOf(u - 0.08);
  const rx = rxBase * (1 - 0.16 * p);
  const crownY = -ryBase * (1 + 0.13 * p);
  const rimX = rx * (0.94 - 0.09 * rimLag) * frac;

  const rimY =
    ryBase * (0.14 + 0.1 * rimLag) + Math.sqrt(Math.max(0, 1 - frac * frac)) * ryBase * 0.09;

  return path()
    .moveTo([0, q(crownY * 0.92)])
    .curveTo(
      [q(rx * frac * 0.58), q(crownY * 0.72)],
      [q(rx * frac * 1.04), q(-ryBase * 0.22)],
      [q(rimX), q(rimY)],
    );
};

// Traveling-wave tentacle or oral arm attached directly to the pulsing bell margin
interface TentacleSpec {
  readonly attachFrac: number; // -1..1 across bell width
  readonly length: number;
  readonly amp: number;
  readonly freq: number;
  readonly phase: number;
  readonly splay: number;
  readonly width: number;
  readonly color: Hex;
  readonly haloColor: Hex;
  readonly opacity: number;
  readonly isArm?: boolean;
}

const tentacleGeometry = (
  u: number,
  spec: TentacleSpec,
  rxBase: number,
  ryBase: number,
): Geometry => {
  const p = pulseOf(u);
  const rimLag = pulseOf(u - 0.08);
  const rx = rxBase * (1 - 0.16 * p);
  const rimX = rx * (spec.isArm ? 0.45 : 0.92 - 0.09 * rimLag) * spec.attachFrac;

  const rimY =
    ryBase * (spec.isArm ? 0.06 : 0.16 + 0.1 * rimLag) +
    Math.sqrt(Math.max(0, 1 - spec.attachFrac * spec.attachFrac)) * ryBase * 0.06;

  const segments = 6;
  const omega = u * TAU;

  const pts: Vec[] = Array.from({ length: segments + 1 }, (_, i) => {
    const s = i / segments;
    const env = Math.pow(s, 1.28);
    const wave1 = Math.sin(spec.freq * s - omega + spec.phase);
    const wave2 = 0.34 * Math.sin(spec.freq * 1.9 * s - 2 * omega + spec.phase * 1.4);
    const x = rimX + spec.splay * s + spec.amp * env * (wave1 + wave2);
    const y = rimY + spec.length * s + Math.cos(spec.freq * s - omega + spec.phase) * 3.5 * env;

    return [x, y];
  });

  return smoothOpen(pts);
};

// --- jellyfish factory (reusable for hero + deep companions) ----------------

interface JellyPalette {
  readonly outerTop: Hex;
  readonly outerMid: Hex;
  readonly outerEdge: Hex;
  readonly innerGlow: Hex;
  readonly heartCore: Hex;
  readonly heartWarm: Hex;
  readonly rimLine: Hex;
  readonly pulseColor: Hex;
  readonly armColor: Hex;
  readonly armHalo: Hex;
  readonly tentacleA: Hex;
  readonly tentacleB: Hex;
}

interface JellyConfig {
  readonly id: string;
  readonly at: Vec;
  readonly scale: number;
  readonly tilt: number;
  readonly phaseShift: number; // 0..1 fraction of CYCLE
  readonly opacity: number;
  readonly detailed: boolean;
  readonly palette: JellyPalette;
  readonly seed: number;
}

const HERO_PALETTE: JellyPalette = {
  outerTop: "#7CF7FF",
  outerMid: "#3B82F6",
  outerEdge: "#7C3AED",
  innerGlow: "#38BDF8",
  heartCore: "#FFF2C6",
  heartWarm: "#FF5EA8",
  rimLine: "#B8FAFF",
  pulseColor: "#7CF7FF",
  armColor: "#FF9AE0",
  armHalo: "#C084FC",
  tentacleA: "#7CE8FF",
  tentacleB: "#A78BFA",
};

const VIOLET_PALETTE: JellyPalette = {
  outerTop: "#F0ABFC",
  outerMid: "#9333EA",
  outerEdge: "#4F46E5",
  innerGlow: "#C084FC",
  heartCore: "#FFE7C2",
  heartWarm: "#FB7185",
  rimLine: "#F5D0FE",
  pulseColor: "#F0ABFC",
  armColor: "#FDA4AF",
  armHalo: "#A855F7",
  tentacleA: "#E879F9",
  tentacleB: "#818CF8",
};

const MINT_PALETTE: JellyPalette = {
  outerTop: "#99F6E4",
  outerMid: "#0EA5E9",
  outerEdge: "#3B82F6",
  innerGlow: "#2DD4BF",
  heartCore: "#FEF3C7",
  heartWarm: "#34D399",
  rimLine: "#CCFBF1",
  pulseColor: "#5EEAD4",
  armColor: "#67E8F9",
  armHalo: "#38BDF8",
  tentacleA: "#5EEAD4",
  tentacleB: "#60A5FA",
};

const JELLIES: readonly JellyConfig[] = [
  {
    id: "far-mint",
    at: [792, 162],
    scale: 0.36,
    tilt: 17,
    phaseShift: 0.62,
    opacity: 0.56,
    detailed: false,
    palette: MINT_PALETTE,
    seed: 303,
  },
  {
    id: "mid-violet",
    at: [192, 232],
    scale: 0.56,
    tilt: -15,
    phaseShift: 0.31,
    opacity: 0.78,
    detailed: false,
    palette: VIOLET_PALETTE,
    seed: 202,
  },
  {
    id: "hero",
    at: [492, 214],
    scale: 1,
    tilt: 7,
    phaseShift: 0,
    opacity: 1,
    detailed: true,
    palette: HERO_PALETTE,
    seed: 101,
  },
];

const RX = 88;
const RY = 66;

const buildJelly = (cfg: JellyConfig): SceneElement => {
  const jRnd = rnd(cfg.seed);
  const { palette, phaseShift, detailed } = cfg;

  const uAt = (t: number): number => (((t / CYCLE + phaseShift) % 1) + 1) % 1;

  // Fluid body bob & gentle rotational sway synced to the propulsion cycle
  const bob = sampled(
    (t): Vec => {
      const u = uAt(t);

      return [Math.sin(u * TAU) * 5.5, surgeOf(u) * 15];
    },
    span(0, CYCLE),
    { step: 0.12, tolerance: 0.35, precision: 1 },
  ).loop(CYCLE);

  const sway = sampled((t) => cfg.tilt + Math.sin(uAt(t) * TAU - 0.5) * 3.8, span(0, CYCLE), {
    step: 0.16,
    tolerance: 0.2,
    precision: 2,
  }).loop(CYCLE);

  // Deforming bell geometries
  const outerBell = sampled((t) => bellGeometry(uAt(t), RX, RY), span(0, CYCLE), {
    step: 0.12,
    tolerance: 1.1,
  }).loop(CYCLE);

  const innerBell = sampled((t) => innerBellGeometry(uAt(t), RX, RY), span(0, CYCLE), {
    step: 0.12,
    tolerance: 1.1,
  }).loop(CYCLE);

  const domeHighlight = sampled((t) => highlightGeometry(uAt(t), RX, RY), span(0, CYCLE), {
    step: 0.14,
    tolerance: 1.1,
  }).loop(CYCLE);

  // Bioluminescent heart pulse (peaks warmly during each contraction stroke)
  const heartPulse = sampled((t) => 0.68 + 0.32 * Math.max(0, pulseOf(uAt(t))), span(0, CYCLE), {
    step: 0.12,
    tolerance: 0.02,
    precision: 2,
  }).loop(CYCLE);

  // Shed propulsion vortex ring drifting down and dissolving beneath the bell
  const vortexOffset = sampled(
    (t): Vec => {
      const u = uAt(t);

      return [0, RY * 0.25 + u * 118];
    },
    span(0, CYCLE),
    { step: 0.15, tolerance: 0.8, precision: 1 },
  ).loop(CYCLE);

  const vortexScale = sampled((t) => 0.75 + uAt(t) * 0.95, span(0, CYCLE), {
    step: 0.15,
    tolerance: 0.02,
    precision: 2,
  }).loop(CYCLE);

  const vortexOpacity = sampled(
    (t) => {
      const u = uAt(t);

      if (u < 0.12) return (u / 0.12) * 0.32;

      return Math.max(0, 0.32 * Math.pow(1 - (u - 0.12) / 0.88, 1.8));
    },
    span(0, CYCLE),
    { step: 0.12, tolerance: 0.015, precision: 2 },
  ).loop(CYCLE);

  // Radial bioluminescent comb-row nerve pulses
  const meridianFracs = detailed ? [-0.72, -0.45, -0.2, 0, 0.2, 0.45, 0.72] : [-0.55, 0, 0.55];

  const meridians = meridianFracs.map((frac, idx) => ({
    key: `mer-${idx}`,
    geom: sampled((t) => meridianGeometry(uAt(t), frac, RX, RY), span(0, CYCLE), {
      step: 0.14,
      tolerance: 1.2,
    }).loop(CYCLE),
  }));

  const nerveTrim = sampled(
    (t): Vec => {
      const u = uAt(t);
      const head = Math.min(1, u * 1.45);
      const tail = Math.max(0, head - 0.34);

      return [tail, head];
    },
    span(0, CYCLE),
    { step: 0.1, tolerance: 0.015, precision: 3 },
  ).loop(CYCLE);

  const nerveOpacity = sampled(
    (t) => {
      const u = uAt(t);

      if (u > 0.72) return 0;

      return Math.sin((u / 0.72) * Math.PI) * 0.9;
    },
    span(0, CYCLE),
    { step: 0.1, tolerance: 0.02, precision: 2 },
  ).loop(CYCLE);

  // Ruffled central oral arms
  const armFracs = detailed ? [-0.62, -0.22, 0.22, 0.62] : [-0.38, 0.38];

  const oralArms: readonly { spec: TentacleSpec; geom: Track<Geometry> }[] = armFracs.map(
    (frac, idx) => {
      const spec: TentacleSpec = {
        attachFrac: frac,
        length: 175 + (idx % 2) * 32 + jRnd() * 18,
        amp: 20 + jRnd() * 10,
        freq: 4.8 + jRnd() * 1.2,
        phase: idx * 1.15 + jRnd() * 0.5,
        splay: frac * 22,
        width: detailed ? 5.6 : 4.6,
        color: palette.armColor,
        haloColor: palette.armHalo,
        opacity: 0.78,
        isArm: true,
      };

      return {
        spec,
        geom: sampled((t) => tentacleGeometry(uAt(t), spec, RX, RY), span(0, CYCLE), {
          step: 0.14,
          tolerance: 1.4,
        }).loop(CYCLE),
      };
    },
  );

  // Gossamer marginal stinging tentacles
  const tentacleCount = detailed ? 10 : 5;

  const tentacles: readonly { spec: TentacleSpec; geom: Track<Geometry> }[] = Array.from(
    { length: tentacleCount },
    (_, idx) => {
      const frac = -0.88 + (1.76 * idx) / (tentacleCount - 1);
      const outer = Math.abs(frac);

      const spec: TentacleSpec = {
        attachFrac: frac,
        length: 215 + (1 - outer * 0.35) * 70 + jRnd() * 35,
        amp: 22 + outer * 14 + jRnd() * 8,
        freq: 5.2 + jRnd() * 1.8,
        phase: idx * 0.78 + jRnd() * 0.7,
        splay: frac * 34,
        width: detailed ? 1.55 - outer * 0.35 : 1.4,
        color: idx % 2 === 0 ? palette.tentacleA : palette.tentacleB,
        haloColor: palette.innerGlow,
        opacity: q(0.42 + (1 - outer * 0.45) * 0.44),
      };

      return {
        spec,
        geom: sampled((t) => tentacleGeometry(uAt(t), spec, RX, RY), span(0, CYCLE), {
          step: 0.14,
          tolerance: 1.5,
        }).loop(CYCLE),
      };
    },
  );

  return (
    <Group key={cfg.id} offset={cfg.at} scale={cfg.scale} opacity={cfg.opacity} origin="at">
      <Group motion={{ offset: bob, rotate: sway }} origin="at">
        {/* Soft feathered ambient bioluminescent aura around the jellyfish */}
        <Shape
          geometry={circle(165)}
          at={[0, 12]}
          anchor="center"
          opacity={heartPulse}
          fill={radial({
            center: [0, 0],
            radius: 165,
            stops: [
              [0, mix(palette.innerGlow, "#00000000", 0.34)],
              [0.36, mix(palette.outerEdge, "#00000000", 0.14)],
              [0.72, mix(palette.outerEdge, "#00000000", 0.03)],
              [1, "#00000000"],
            ],
          })}
        />

        {/* Shed propulsion vortex ring drifting down beneath the bell */}
        {detailed && (
          <Group
            motion={{ offset: vortexOffset, scale: vortexScale }}
            opacity={vortexOpacity}
            origin="at"
          >
            <Shape
              geometry={ellipse(62, 13)}
              stroke={{ color: palette.pulseColor, width: 2.2 }}
              opacity={0.75}
            />
            <Shape
              geometry={ellipse(54, 10)}
              stroke={{ color: "#FFFFFF", width: 0.9 }}
              opacity={0.45}
            />
          </Group>
        )}

        {/* Gossamer marginal tentacles (back layer) */}
        <Group>
          {tentacles.map(({ spec, geom }, idx) => (
            <Group key={`tent-${idx}`} opacity={spec.opacity}>
              {detailed && (
                <Shape
                  geometry={geom}
                  opacity={0.22}
                  stroke={{ color: spec.haloColor, width: q(spec.width * 3.4), cap: "round" }}
                />
              )}
              <Shape
                geometry={geom}
                stroke={{ color: spec.color, width: spec.width, cap: "round" }}
              />
            </Group>
          ))}
        </Group>

        {/* Ruffled central oral arms */}
        <Group>
          {oralArms.map(({ spec, geom }, idx) => (
            <Group key={`arm-${idx}`} opacity={spec.opacity}>
              <Shape
                geometry={geom}
                opacity={0.22}
                stroke={{ color: spec.haloColor, width: q(spec.width * 2.8), cap: "round" }}
              />
              <Shape
                geometry={geom}
                opacity={0.62}
                stroke={{ color: spec.color, width: spec.width, cap: "round" }}
              />
              <Shape
                geometry={geom}
                opacity={0.85}
                stroke={{ color: "#FFF4FA", width: q(spec.width * 0.28), cap: "round" }}
              />
            </Group>
          ))}
        </Group>

        {/* Translucent outer gelatinous bell */}
        <Shape
          geometry={outerBell}
          fill={linear({
            from: [0, -RY * 1.15],
            to: [0, RY * 0.35],
            stops: [
              [0, mix(palette.outerTop, "#00000000", 0.56)],
              [0.48, mix(palette.outerMid, "#00000000", 0.38)],
              [1, mix(palette.outerEdge, "#00000000", 0.28)],
            ],
          })}
          stroke={{ color: mix(palette.rimLine, "#00000000", 0.72), width: 1.8, join: "round" }}
        />

        {/* Inner subumbrella cavity */}
        <Shape
          geometry={innerBell}
          fill={radial({
            center: [0, -RY * 0.25],
            radius: RX * 0.85,
            stops: [
              [0, mix(palette.innerGlow, "#00000000", 0.52)],
              [0.55, mix(palette.outerMid, "#00000000", 0.22)],
              [1, "#00000000"],
            ],
          })}
        />

        {/* Glowing warm bioluminescent gonads (soft 4-lobe radial clover inside the bell) */}
        <Group opacity={heartPulse}>
          <Shape
            geometry={circle(48)}
            at={[0, -RY * 0.34]}
            anchor="center"
            fill={radial({
              center: [0, 0],
              radius: 48,
              stops: [
                [0, mix(palette.heartCore, "#00000000", 0.88)],
                [0.32, mix(palette.heartWarm, "#00000000", 0.52)],
                [0.68, mix(palette.heartWarm, "#00000000", 0.12)],
                [1, "#00000000"],
              ],
            })}
          />
          {[
            [-13, -RY * 0.38, -28],
            [13, -RY * 0.38, 28],
            [-9, -RY * 0.24, 24],
            [9, -RY * 0.24, -24],
          ].map(([gx, gy, rot], i) => (
            <Shape
              key={`gonad-${i}`}
              geometry={ellipse(11, 5.2)}
              at={[gx!, gy!]}
              anchor="center"
              rotate={rot!}
              origin="at"
              fill={mix(palette.heartWarm, "#00000000", 0.42)}
              stroke={{ color: mix(palette.heartCore, "#00000000", 0.45), width: 0.9 }}
            />
          ))}
        </Group>

        {/* Radial meridian ribs & traveling bioluminescent nerve pulses */}
        <Group>
          {meridians.map(({ key, geom }) => (
            <Group key={key}>
              <Shape
                geometry={geom}
                opacity={0.28}
                stroke={{ color: palette.rimLine, width: 1.1, cap: "round" }}
              />
              <Shape
                geometry={geom}
                trim={nerveTrim}
                opacity={nerveOpacity}
                stroke={{ color: palette.pulseColor, width: 3.4, cap: "round" }}
              />
              <Shape
                geometry={geom}
                trim={nerveTrim}
                opacity={nerveOpacity}
                stroke={{ color: "#FFFFFF", width: 1.3, cap: "round" }}
              />
            </Group>
          ))}
        </Group>

        {/* Glassy fresnel dome highlight */}
        <Shape
          geometry={domeHighlight}
          opacity={0.62}
          stroke={{ color: "#FFFFFF", width: 2.2, cap: "round" }}
        />
      </Group>
    </Group>
  );
};

// --- pelagic ocean atmosphere: god-rays & bioluminescent plankton -----------

const GOD_RAYS: readonly {
  readonly pts: readonly Vec[];
  readonly delay: number;
  readonly peak: number;
}[] = [
  {
    pts: [
      [110, -10],
      [230, -10],
      [120, 440],
      [-40, 440],
    ],
    delay: 0,
    peak: 0.14,
  },
  {
    pts: [
      [340, -10],
      [510, -10],
      [420, 470],
      [215, 470],
    ],
    delay: 1.8,
    peak: 0.16,
  },
  {
    pts: [
      [620, -10],
      [760, -10],
      [720, 430],
      [535, 430],
    ],
    delay: 3.4,
    peak: 0.12,
  },
];

const plankRnd = rnd(88421);

interface Plankton {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly color: Hex;
  readonly driftX: number;
  readonly driftY: number;
  readonly glow: boolean;
  readonly phase: number;
}

const PLANKTON_COLORS: readonly Hex[] = ["#7CF7FF", "#C084FC", "#FFE7A8", "#93C5FD", "#5EEAD4"];

const plankton: readonly Plankton[] = Array.from({ length: 52 }, (_, i) => ({
  x: q(plankRnd() * WIDTH),
  y: q(plankRnd() * HEIGHT),
  r: q(0.8 + plankRnd() * 1.9),
  color: PLANKTON_COLORS[Math.floor(plankRnd() * PLANKTON_COLORS.length)]!,
  driftX: q((plankRnd() - 0.5) * 28),
  driftY: q(-(10 + plankRnd() * 24)),
  glow: i < 16,
  phase: i % 4,
}));

// Four shared seamless-loop drift & shimmer tracks for plankton
const planktonDrifts: readonly Track<Vec>[] = [
  track<Vec>([0, 0])
    .to([14, -18], span(0, 4), ease.inOut)
    .to([0, 0], span(4, 4), ease.inOut)
    .loop(8),
  track<Vec>([0, 0])
    .to([-16, -14], span(0, 4), ease.inOut)
    .to([0, 0], span(4, 4), ease.inOut)
    .loop(8),
  track<Vec>([0, 0])
    .to([10, 16], span(0, 4), ease.inOut)
    .to([0, 0], span(4, 4), ease.inOut)
    .loop(8),
  track<Vec>([0, 0])
    .to([-12, 14], span(0, 4), ease.inOut)
    .to([0, 0], span(4, 4), ease.inOut)
    .loop(8),
];

const planktonPulses: readonly Track<number>[] = [
  track(0.22).to(0.92, span(0.4, 1.6), ease.inOut).to(0.22, span(2.0, 2.0), ease.inOut).loop(4),
  track(0.85).to(0.18, span(0.2, 1.8), ease.inOut).to(0.85, span(2.0, 2.0), ease.inOut).loop(4),
  track(0.16).to(0.88, span(1.0, 1.5), ease.inOut).to(0.16, span(2.5, 1.5), ease.inOut).loop(4),
  track(0.72).to(0.2, span(0.8, 1.6), ease.inOut).to(0.72, span(2.4, 1.6), ease.inOut).loop(4),
];

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: SECONDS,
    still: 1.8,
    title: "Abyssal Drift",
    desc: "Three bioluminescent jellyfish pulse through a deep-ocean water column, their scalloped bells, ruffled oral arms, and gossamer tentacles solved as traveling fluid waves alongside radial nerve pulses, shed vortex rings, volumetric god-rays, and drifting plankton.",
  },
  () => (
    <Group>
      {/* 1. Deep pelagic-to-abyssal ocean gradient */}
      <Shape
        geometry={rect(WIDTH, HEIGHT)}
        fill={linear({
          from: [0, 0],
          to: [0, HEIGHT],
          stops: [
            [0, "#0A274D"],
            [0.24, "#061938"],
            [0.62, "#030D22"],
            [1, "#01040D"],
          ],
        })}
      />

      {/* Soft sunlit surface scatter at the top of the water column */}
      <Shape
        geometry={rect(WIDTH, 180)}
        fill={linear({
          from: [0, 0],
          to: [0, 180],
          stops: [
            [0, "#38BDF830"],
            [0.42, "#0EA5E912"],
            [1, "#00000000"],
          ],
        })}
      />

      {/* 2. Volumetric underwater god-rays swaying gently from the surface */}
      <Group blend="screen">
        {GOD_RAYS.map((ray, i) => {
          const breathe = track(ray.peak * 0.4)
            .to(ray.peak * 0.72, span(ray.delay, 2.0), ease.inOut)
            .to(ray.peak * 0.4, span(ray.delay + 2.0, 2.0), ease.inOut)
            .loop(8);

          const [tl, tr, br, bl] = ray.pts;

          const inset = (a: Vec, b: Vec, f: number): Vec => [
            q(a[0] + (b[0] - a[0]) * f),
            q(a[1] + (b[1] - a[1]) * f),
          ];

          return (
            <Group key={`ray-${i}`} opacity={breathe}>
              <Shape
                geometry={polygon(...ray.pts)}
                opacity={0.45}
                fill={linear({
                  from: [tl![0], 0],
                  to: [bl![0], 450],
                  stops: [
                    [0, "#7CE8FF90"],
                    [0.45, "#38BDF82C"],
                    [1, "#00000000"],
                  ],
                })}
              />
              <Shape
                geometry={polygon(
                  inset(tl!, tr!, 0.22),
                  inset(tr!, tl!, 0.22),
                  inset(br!, bl!, 0.22),
                  inset(bl!, br!, 0.22),
                )}
                opacity={0.65}
                fill={linear({
                  from: [tl![0], 0],
                  to: [bl![0], 420],
                  stops: [
                    [0, "#A5F3FC98"],
                    [0.48, "#38BDF830"],
                    [1, "#00000000"],
                  ],
                })}
              />
            </Group>
          );
        })}
      </Group>

      {/* 3. Background marine snow & drifting bioluminescent plankton */}
      <Group blend="screen">
        {plankton.map((p, i) => (
          <Group
            key={`plank-${i}`}
            offset={[p.x, p.y]}
            motion={{ offset: planktonDrifts[p.phase] }}
            opacity={planktonPulses[(p.phase + i) % planktonPulses.length]}
          >
            {p.glow && (
              <Shape
                geometry={circle(p.r * 5.2)}
                fill={radial({
                  center: [0, 0],
                  radius: p.r * 5.2,
                  stops: [
                    [0, mix(p.color, "#00000000", 0.55)],
                    [0.45, mix(p.color, "#00000000", 0.16)],
                    [1, "#00000000"],
                  ],
                })}
              />
            )}
            <Shape geometry={circle(p.r)} fill={p.color} />
          </Group>
        ))}
      </Group>

      {/* 4. Three bioluminescent jellyfish (back-to-front depth order) */}
      <Group blend="screen">{JELLIES.map(buildJelly)}</Group>

      {/* 5. Subtle abyssal vignette at the bottom edge for deep-sea framing */}
      <Shape
        geometry={rect(WIDTH, 90)}
        at={[0, HEIGHT - 90]}
        fill={linear({
          from: [0, 0],
          to: [0, 90],
          stops: [
            [0, "#01040D00"],
            [1, "#01030AD8"],
          ],
        })}
      />
    </Group>
  ),
);
