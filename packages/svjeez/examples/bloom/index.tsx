import {
  def,
  draw,
  ease,
  el,
  enter,
  fx,
  motion,
  render,
  wiggle,
  type Color,
  type Motion,
  type SvgNode,
  type Values,
} from "svjeez";

const W = 600;
const H = 600;
const D = 8;
const CX = 300;
const CY = 270;

const OPEN = 0.3;
const CLOSE = 6.3;

const C = {
  bgTop: "#0D0B1F",
  bgBottom: "#04030A",
  dust: "#3B3566",
  ring: "#2B2750",
  label: "#7D76A8",
  word: "#EDE8FF",
  core: "#FFF4DC",
  pink: "#FF5FA8",
  violet: "#9F8CFF",
  cyan: "#3EE6D6",
  gold: "#FFCF6B",
} as const;

const CSS = `.sans{font-family:"Inter","SF Pro Display",system-ui,sans-serif}.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace}`;

const glow = fx.glow({ blur: 4 });
const softGlow = fx.glow({ blur: 9 });

const point = (radius: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;

  return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius };
};

const xy = ({ x, y }: { x: number; y: number }) => `${x.toFixed(2)} ${y.toFixed(2)}`;

const petal = (reach: number, width: number, degrees: number): string => {
  const flare = (Math.atan2(width, reach / 2) * 180) / Math.PI;
  const control = Math.hypot(width, reach / 2);

  return `M${CX} ${CY}Q${xy(point(control, degrees + flare))} ${xy(point(reach, degrees))}Q${xy(point(control, degrees - flare))} ${CX} ${CY}Z`;
};

const sweep = (from: Color, to: Color) =>
  def.linearGradient(
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    <>
      <stop offset={0} stopColor={from} />
      <stop offset={1} stopColor={to} />
    </>,
  );

const bg = def.linearGradient(
  { x1: 0, y1: 0, x2: 0, y2: 1 },
  <>
    <stop offset={0} stopColor={C.bgTop} />
    <stop offset={1} stopColor={C.bgBottom} />
  </>,
);

const aurora = def.radialGradient(
  { cx: 0.5, cy: 0.45, r: 0.5 },
  <>
    <stop
      offset={0}
      stopOpacity={0.28}
      animation={motion({ stopColor: C.violet })
        .to({ stopColor: C.pink }, D / 3, ease.inOut)
        .to({ stopColor: C.cyan }, D / 3, ease.inOut)
        .to({ stopColor: C.violet }, D / 3, ease.inOut)}
    />
    <stop offset={1} stopColor={C.bgBottom} stopOpacity={0} />
  </>,
);

const vignette = def.radialGradient(
  { cx: 0.5, cy: 0.45, r: 0.55 },
  <>
    <stop offset={0} stopColor="white" />
    <stop offset={1} stopColor="black" />
  </>,
);

const dots = def.pattern(
  { width: 22, height: 22, patternUnits: "userSpaceOnUse" },
  <circle cx={11} cy={11} r={0.9} fill={C.dust} />,
);

const fadeEdges = def.mask({}, <rect width={W} height={H} fill={vignette} />);

const lifetime = (delay: number, from: Values<"opacity" | "scale"> = { opacity: 0 }) =>
  enter({ at: OPEN + delay, over: 0.9 }, from)
    .at(CLOSE + 0.4 - delay / 2)
    .to(from, 0.8, ease.in);

const spin = (period: number, turns = 1): Motion<"rotate"> =>
  motion({ rotate: 0 })
    .to({ rotate: 360 * turns }, period, ease.linear)
    .loop(period);

function Backdrop(): SvgNode {
  return (
    <>
      <rect width={W} height={H} fill={bg} />
      <rect width={W} height={H} fill={dots} mask={fadeEdges} />
      <rect width={W} height={H} fill={aurora} />
    </>
  );
}

const outer = sweep(C.pink, C.violet);
const inner = sweep(C.cyan, C.violet);

const halo = def.radialGradient(
  { gradientUnits: "userSpaceOnUse", cx: CX, cy: CY, r: 116 },
  <>
    <stop offset={0} stopColor={C.gold} stopOpacity={0.4} />
    <stop offset={1} stopColor={C.pink} stopOpacity={0} />
  </>,
);

function Ring({
  count,
  reach,
  width,
  turn,
  stroke,
  delay,
}: {
  count: number;
  reach: number;
  width: number;
  turn: number;
  stroke: typeof outer;
  delay: number;
}): SvgNode {
  const gap = 0.07;

  return (
    <g fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round">
      {Array.from({ length: count }, (_, i) =>
        el.path({
          d: petal(reach, width, turn + (360 / count) * i - 90),
          animation: draw({ at: OPEN + delay + i * gap, over: 1 })
            .at(CLOSE + (count - 1 - i) * 0.04)
            .to({ draw: 0 }, 0.7, ease.in),
        }),
      )}
    </g>
  );
}

function Rosette(): SvgNode {
  const breathe = motion({ scale: 1 })
    .to({ scale: 1.045 }, 1, ease.inOut)
    .to({ scale: 1 }, 1, ease.inOut)
    .loop(2);

  return (
    <g animation={[spin(D, 0.25), breathe]}>
      <circle
        cx={CX}
        cy={CY}
        r={128}
        fill="none"
        stroke={C.violet}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="0.1 9"
        opacity={0.6}
      />
      <g animation={lifetime(0.8, { opacity: 0, scale: 0.4 })}>
        {Array.from({ length: 12 }, (_, i) =>
          el.path({ d: petal(112, 30, i * 30 - 90), fill: halo }),
        )}
      </g>
      <Ring count={12} reach={118} width={44} turn={0} stroke={outer} delay={0} />
      <Ring count={12} reach={78} width={30} turn={15} stroke={inner} delay={0.35} />
    </g>
  );
}

function Orbit({
  radius,
  period,
  turns,
  tail,
  color,
  delay,
}: {
  radius: number;
  period: number;
  turns: 1 | -1;
  tail: number;
  color: Color;
  delay: number;
}): SvgNode {
  const head = point(radius, -90);
  const end = point(radius, -90 - tail * turns);

  const trail = def.linearGradient(
    { gradientUnits: "userSpaceOnUse", x1: end.x, y1: end.y, x2: head.x, y2: head.y },
    <>
      <stop offset={0} stopColor={color} stopOpacity={0} />
      <stop offset={1} stopColor={color} />
    </>,
  );

  return el.g({ animation: [spin(period, turns), lifetime(delay)] }, [
    el.circle({ cx: CX, cy: CY, r: radius, fill: "none", stroke: C.ring, strokeWidth: 1 }),
    el.path({
      d: `M${xy(end)}A${radius} ${radius} 0 0 ${turns === 1 ? 1 : 0} ${xy(head)}`,
      fill: "none",
      stroke: trail,
      strokeWidth: 2.5,
      strokeLinecap: "round",
    }),
    el.circle({ cx: head.x, cy: head.y, r: 3.5, fill: color, filter: glow }),
  ]);
}

function Ripple({ phase }: { phase: number }): SvgNode {
  const every = 1.8;
  let wave: Motion<"scale" | "opacity"> = motion({ scale: 0.2, opacity: 0 });

  for (let t = OPEN + 1.4 + phase; t + every <= D; t += every) {
    wave = wave
      .at(t)
      .set({ scale: 0.2 })
      .to({ scale: 3.4 }, every, ease.out)
      .at(t)
      .to({ opacity: 0.5 }, 0.15)
      .to({ opacity: 0 }, every - 0.15, ease.inOut);
  }

  return el.circle({
    cx: CX,
    cy: CY,
    r: 30,
    fill: "none",
    stroke: C.core,
    strokeWidth: 0.8,
    animation: wave,
  });
}

function Core(): SvgNode {
  const beat = motion({ scale: 1 })
    .to({ scale: 1.3 }, 0.25)
    .to({ scale: 1 }, 0.75, ease.inOut)
    .loop(1);

  return (
    <g filter={softGlow}>
      <circle
        cx={CX}
        cy={CY}
        r={8}
        fill={C.core}
        animation={[
          enter({ at: OPEN + 1.1, over: 0.6 }, { scale: 0, opacity: 0 }, ease.pop)
            .at(CLOSE + 0.5)
            .to({ scale: 0, opacity: 0 }, 0.5, ease.in),
          beat,
        ]}
      />
    </g>
  );
}

function Pollen(): SvgNode {
  return (
    <g fill={C.gold}>
      {Array.from({ length: 18 }, (_, i) => {
        const { x, y } = point(214 + (i % 3) * 14, i * 137.508);

        return el.circle({
          cx: x,
          cy: y,
          r: i % 4 === 0 ? 1.8 : 1.1,
          animation: [
            lifetime(0.6 + (i % 5) * 0.12),
            wiggle({ x: 7, y: 7, opacity: 0.7 }, { seed: `pollen-${i}`, rate: 1.5, period: D / 2 }),
          ],
        });
      })}
    </g>
  );
}

function Title(): SvgNode {
  const word = "BLOOM";
  const pitch = 34;
  const left = CX - ((word.length - 1) * pitch) / 2;
  const hidden = { opacity: 0, y: 12, blur: 8 } as const;

  return (
    <>
      {[...word].map((letter, i) =>
        el.text(
          {
            x: left + i * pitch,
            y: 534,
            class: "sans",
            fontSize: 30,
            fontWeight: 300,
            fill: C.word,
            textAnchor: "middle",
            animation: enter({ at: OPEN + 1.3 + i * 0.09, over: 0.9 }, hidden)
              .at(CLOSE + i * 0.06)
              .to({ opacity: 0, y: -10, blur: 8 }, 0.7, ease.in),
          },
          letter,
        ),
      )}
      <text
        x={CX}
        y={564}
        class="mono"
        fontSize={10}
        letterSpacing={4}
        fill={C.label}
        textAnchor="middle"
        animation={lifetime(1.9)}
      >
        SVG · MOTION · {D}S LOOP
      </text>
    </>
  );
}

export function buildBloom(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Bloom",
      desc: "A two-ring rosette strokes itself open around a beating core, ripples spread outward, comets circle on three orbits, pollen drifts, and the whole thing folds shut again on an eight-second loop.",
      css: CSS,
      reducedMotion: { at: 4 },
      comment: "Generated by svjeez. Edit examples/bloom/index.tsx instead of this file.",
    },
    <>
      <Backdrop />
      <Orbit radius={150} period={D / 2} turns={1} tail={70} color={C.cyan} delay={0.2} />
      <Orbit radius={176} period={D} turns={-1} tail={110} color={C.pink} delay={0.35} />
      <Orbit radius={200} period={D / 3} turns={1} tail={40} color={C.gold} delay={0.5} />
      <Pollen />
      <Ripple phase={0} />
      <Ripple phase={0.6} />
      <Ripple phase={1.2} />
      <Rosette />
      <Core />
      <Title />
    </>,
  );
}

export default buildBloom;
