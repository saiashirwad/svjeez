import {
  Group,
  Shape,
  alpha,
  arc,
  blur,
  displace,
  ease,
  linear,
  merge,
  noise,
  path,
  polygon,
  radial,
  random,
  rect,
  ride,
  span,
  spline,
  track,
  wiggle,
  type Color,
  type Geometry,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon } from "../kit";
import { Pelican, type Look } from "../rig";

export const SUN = 7;

/**
 * Observatory footage of the solar limb, H-alpha style: a granulated, filamented disc turning slowly under a spicule
 * fringe and two prominence loops, with a black pelican silhouette riding the edge.
 */

const R = 2200;
const sun = horizon(398, R);
const [cx, cy] = sun.center;

const ink = "#070302";
const warm = "#F6E7D2";

const look: Look = {
  line: ink,
  width: 1.1,
  body: ink,
  wing: ink,
  primaries: ink,
  beak: ink,
  pouch: ink,
  skin: ink,
  leg: ink,
  frame: ink,
  tyre: ink,
  metal: ink,
  detail: false,
  far: 1,
};

const rimColor = "#FF8A2E";

const rim: Look = {
  ...look,
  line: rimColor,
  body: rimColor,
  wing: rimColor,
  primaries: rimColor,
  beak: rimColor,
  pouch: rimColor,
  skin: rimColor,
  leg: rimColor,
  frame: rimColor,
  tyre: rimColor,
  metal: rimColor,
};

/** A point on a circle about the sun's centre, at `deg` (−90 is straight up) and radius `r`. */
const polar = (deg: number, r: number): Vec => {
  const a = (deg * Math.PI) / 180;

  return [Math.round(r * Math.cos(a) * 10) / 10, Math.round(r * Math.sin(a) * 10) / 10];
};

/** The visible cap of the disc, closed by a chord well below the frame, so textures fill a small box. */
const cap = (half: number): Geometry =>
  polygon(...Array.from({ length: 97 }, (_, i) => polar(-90 - half + (i / 96) * half * 2, R)));

// ── sky ───────────────────────────────────────────────────────────────────

const Sky = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W, H)}
      fill={[
        linear({
          from: [0, 0],
          to: [0, 520],
          stops: [
            [0, "#050201"],
            [0.6, "#140603"],
            [1, "#2A0C04"],
          ],
        }),
        {
          paint: noise({
            frequency: [0.035, 0.0016],
            octaves: 3,
            seed: 21,
            ramp: [
              [0.35, alpha("#7A2A10", 0)],
              [0.75, alpha("#7A2A10", 0.5)],
            ],
          }),
          blend: "screen",
          opacity: 0.35,
        },
      ]}
    />
    {/* Corona: a broad ring of glow hugging the limb, brightest just above it. */}
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [cx, cy],
        radius: R * 1.16,
        stops: [
          [R / (R * 1.16) - 0.002, alpha("#FF7A26", 0.75)],
          [0.875, alpha("#E0521A", 0.42)],
          [0.91, alpha("#9A2A0C", 0.16)],
          [0.96, alpha("#5A1606", 0.05)],
          [1, alpha("#5A1606", 0)],
        ],
      })}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [W * 0.46, 420],
        radius: [W * 0.62, 260],
        stops: [
          [0, alpha("#FFB25A", 0.16)],
          [1, alpha("#FFB25A", 0)],
        ],
      })}
      blend="screen"
    />
  </Group>
);

// ── disc ──────────────────────────────────────────────────────────────────

const HALF = 36;

const Surface = (): SceneElement => (
  <Shape
    geometry={cap(HALF)}
    fill={[
      "#B83A08",
      {
        paint: noise({
          frequency: 0.0085,
          octaves: 3,
          seed: 7,
          ramp: [
            [0.3, "#8A2206"],
            [0.5, "#C4480C"],
            [0.7, "#EC7C1A"],
          ],
        }),
      },
      {
        paint: noise({
          frequency: 0.075,
          octaves: 2,
          seed: 3,
          ramp: [
            [0.3, "#4A1003"],
            [0.5, "#B8440E"],
            [0.72, "#FF9C48"],
          ],
        }),
        blend: "overlay",
        opacity: 0.6,
      },
      {
        paint: noise({
          frequency: 0.34,
          octaves: 1,
          seed: 4,
          ramp: [
            [0.3, "#000000"],
            [0.7, "#FFFFFF"],
          ],
        }),
        blend: "soft-light",
        opacity: 0.18,
      },
      {
        paint: noise({
          frequency: [0.0022, 0.0085],
          octaves: 3,
          seed: 15,
          type: "turbulence",
          rotate: 18,
          ramp: [
            [0, alpha("#2A0502", 0.9)],
            [0.035, alpha("#2A0502", 0.45)],
            [0.08, alpha("#2A0502", 0)],
          ],
        }),
        blend: "multiply",
        opacity: 0.85,
      },
      {
        paint: noise({
          frequency: 0.006,
          octaves: 3,
          seed: 31,
          ramp: [
            [0.62, alpha("#FFB45C", 0)],
            [0.8, alpha("#FFB45C", 0.6)],
          ],
        }),
        blend: "screen",
        opacity: 0.35,
      },
    ]}
  />
);

/** Limb darkening, a hot rim and a little bloom; static, since a turning circle keeps its edge. */
const Limb = (): SceneElement => (
  <Group>
    <Shape
      geometry={cap(HALF)}
      fill={radial({
        center: [0, 0],
        radius: R,
        stops: [
          [0.85, alpha("#1A0301", 0)],
          [0.93, alpha("#1A0301", 0.28)],
          [0.975, alpha("#1A0301", 0.55)],
          [0.995, alpha("#1A0301", 0.8)],
          [1, alpha("#1A0301", 0.6)],
        ],
      })}
    />
    <Shape
      geometry={arc({ radius: R - 2, start: -90 - 22, sweep: 44 })}
      stroke={{ color: alpha("#FFB04A", 0.55), width: 10 }}
      effects={[blur(7)]}
    />
    {/* The shared horizon: the limb's bright edge, which morphs into the next shot's curve. */}
    <Shape
      key="horizon"
      geometry={sun.visible(sun.reach)}
      stroke={{ color: "#FFE9B0", width: 1.6 }}
    />
  </Group>
);

// ── spicules ──────────────────────────────────────────────────────────────

/** Thin flame tongues standing along the limb, merged into one path painted with a radial falloff. */
const fringe = (
  count: number,
  seed: number,
  low: number,
  high: number,
  width: number,
): Geometry => {
  const next = random(seed);

  return merge(
    ...Array.from({ length: count }, (_, i) => {
      const deg = -90 - 21 + (i / count) * 42 + (next() - 0.5) * 0.08;
      const h = low + (high - low) * next() ** 1.6;
      const lean = (next() - 0.5) * 0.5;
      const w = width * (0.5 + next()) * 0.045;
      const base = R - 3;

      return path()
        .moveTo(polar(deg - w, base))
        .quadTo(polar(deg - w * 0.3 + lean * 0.3, base + h * 0.6), polar(deg + lean, base + h))
        .quadTo(polar(deg + w * 0.3 + lean * 0.3, base + h * 0.6), polar(deg + w, base))
        .close();
    }),
  );
};

const glowStops = (reach: number, color: Color, peak: number) =>
  radial({
    center: [0, 0],
    radius: R + reach,
    stops: [
      [(R - 4) / (R + reach), alpha(color, peak)],
      [(R + reach * 0.4) / (R + reach), alpha(color, peak * 0.55)],
      [1, alpha(color, 0)],
    ],
  });

const Spicules = (): SceneElement => (
  <Group effects={[displace({ scale: 3, frequency: 0.12, seed: 9, octaves: 2 })]}>
    <Shape geometry={fringe(220, 5, 18, 64, 1.6)} fill={glowStops(64, "#E8641E", 0.6)} />
    <Group effects={[blur(1.6)]}>
      <Shape geometry={fringe(360, 11, 8, 30, 1.2)} fill={glowStops(30, "#FF9C3A", 0.95)} />
    </Group>
  </Group>
);

// ── prominences ───────────────────────────────────────────────────────────

interface Loop {
  readonly from: number;
  readonly to: number;
  readonly height: number;
  readonly seed: number;
  readonly strands: number;
}

/** One arching strand: up from one foot, over a slightly lopsided apex, down to the other. */
const strand = ({ from, to, height }: Loop, next: () => number): Geometry => {
  const d = to - from;
  const jitter = (s: number) => (next() - 0.5) * s;
  const a = from + jitter(d * 0.3);
  const b = to + jitter(d * 0.3);
  const h = height * (0.45 + next() * 0.65);

  return spline([
    polar(a, R - 2),
    polar(a + d * 0.08 + jitter(0.3), R + h * 0.55),
    polar(a + d * 0.3 + jitter(0.4), R + h * 0.95),
    polar((a + b) / 2 + jitter(d * 0.25), R + h),
    polar(b - d * 0.3 + jitter(0.4), R + h * 0.9),
    polar(b - d * 0.08 + jitter(0.3), R + h * 0.5),
    polar(b, R - 2),
  ]);
};

const Prominence = (loop: Loop): SceneElement => {
  const next = random(loop.seed);
  const strands = Array.from({ length: loop.strands }, () => strand(loop, next));

  return (
    <Group>
      {/* Soft body of glowing plasma. */}
      <Group effects={[blur(12)]}>
        {strands.slice(0, 4).map((g, i) => (
          <Shape
            key={`halo-${i}`}
            geometry={g}
            stroke={{ color: alpha("#FF6A1E", 0.26), width: 30, cap: "round" }}
          />
        ))}
      </Group>
      {[0, 1].map((set) => (
        <Group
          key={`set-${set}`}
          effects={[
            displace({ scale: 10, frequency: 0.045, seed: loop.seed + set, octaves: 3 }),
            blur(2.2),
          ]}
          motion={wiggle({ opacity: 0.3 }, { seed: `${loop.seed}-${set}`, rate: 2.5, period: SUN })}
        >
          {strands.map((g, i) =>
            i % 2 === set ? (
              <Shape
                key={`strand-${i}`}
                geometry={g}
                stroke={{
                  color: alpha(i % 3 === 0 ? "#FFC27A" : "#FF7A2E", 0.22 + (i % 4) * 0.08),
                  width: 2.5 + (i % 5) * 1.6,
                  cap: "round",
                }}
              />
            ) : null,
          )}
        </Group>
      ))}
    </Group>
  );
};

/**
 * Everything fixed to the photosphere. It holds still: turning it would re-filter the whole textured surface and the
 * prominences every frame, and the rider moving along the limb already carries the motion.
 */
const Turning = (): SceneElement => (
  <Group>
    <Surface />
    <Prominence from={-86.8} to={-81.4} height={120} seed={3} strands={16} />
    <Prominence from={-104.6} to={-101.6} height={62} seed={8} strands={10} />
  </Group>
);

// ── film ──────────────────────────────────────────────────────────────────

/** Fine sensor grain and a vignette, laid over everything. */
const Lens = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W, H)}
      fill={noise({
        frequency: 0.9,
        octaves: 1,
        seed: 2,
        ramp: [
          [0.3, alpha("#000000", 0.5)],
          [0.5, alpha("#808080", 0)],
          [0.7, alpha("#FFFFFF", 0.5)],
        ],
      })}
      blend="overlay"
      opacity={0.16}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial.across({
        shape: "ellipse",
        stops: [
          [0.55, alpha("#000000", 0)],
          [1, alpha("#000000", 0.55)],
        ],
      })}
    />
  </Group>
);

const SWEEP = 40;
const travel = track(0.455).to(0.462, span(0, SUN), ease.linear);

export const Sun = (): SceneElement => (
  <Group>
    <Sky />
    <Group offset={[cx, cy]}>
      <Turning />
      <Limb />
      <Spicules />
      <Group
        motion={ride(arc({ radius: R, start: -90 - SWEEP / 2, sweep: SWEEP }), travel, {
          turn: true,
        })}
      >
        <Group offset={[0, 2]} scale={1.15} origin="own">
          <Group offset={[0.9, 1.4]} opacity={0.75}>
            <Pelican look={rim} />
          </Group>
          <Pelican look={look} />
        </Group>
      </Group>
    </Group>
    <Lens />
    <Chapter numeral="III" medium="Solar" fill={warm} length={SUN} />
    <Caption when={[1.4, 4.2]} fill={warm}>
      Some days run hot.
    </Caption>
  </Group>
);
