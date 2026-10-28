import { type Color, Glyphs, Stroke, brush, def, ease, enter, font, fx, motion, nib, pencil, render, sampled, strokeFont, wiggle } from "svjeez";

// A sketchbook page printed in two riso inks. The canvas is a square shown edge to edge with
// `object-fit: cover`: wide screens crop the top and bottom, tall ones the sides. The words live in the
// middle, which every shape shows; the doodles live around them, so each screen finds a few.
const S = 1200;
const C = S / 2;
const D = 24;

const display = await font.load(new URL("../fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const mono = await font.load(new URL("../fonts/JetBrainsMono.ttf", import.meta.url), { fallback: ["ui-monospace", "Menlo", "monospace"], ligatures: false });
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

const P = { paper: "#F3ECDF", ink: "#23203A", pink: "#FF5E8E", blue: "#3358E0", sun: "#FFC63D", cloud: "#FFFDF8" } as const satisfies Record<string, Color>;
const multiply = { mixBlendMode: "multiply" } as const;

/** Seeded, so every build scatters the doodles the same way. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = random(11);
const TAU = Math.PI * 2;

/** Roughly how far the pen travels: along the control polygon, close enough to pace the writing. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;
  for (let i = 2; i + 1 < xy.length; i += 2) sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);
  return sum;
};
/** Handwriting, one pen stroke after another at one speed. */
const Written = ({ text, size, x, y, at, color, width, speed = 900 }: { text: string; size: number; x: number; y: number; at: number; color: Color; width: number; speed?: number }) => {
  const strokes = hand
    .path(text, { size, x, y })
    .d.split(/(?=M)/)
    .reduce<{ d: string; at: number; over: number }[]>((out, d) => {
      const start = out.length ? out.at(-1)!.at + out.at(-1)!.over + 0.03 : at;
      return [...out, { d, at: start, over: Math.max(0.05, lengthOf(d) / speed) }];
    }, []);
  return (
    <>
      {strokes.map((s) => (
        <Stroke d={s.d} tool={nib({ size: width, angle: 30, thin: 0.35 })} color={color} draw={{ at: s.at, over: s.over }} ease={ease.linear} />
      ))}
    </>
  );
};

// ─── Paper. ──────────────────────────────────────────────────────────────────

const tooth = def.filter(
  {},
  <>
    <feTurbulence type="fractalNoise" baseFrequency={0.75} numOctaves={3} seed={9} />
    <feColorMatrix values="0 0 0 0 0.14  0 0 0 0 0.12  0 0 0 0 0.2  0 0 0 -1.4 0.9" />
  </>,
);
const warmth = def.radialGradient({}, <><stop offset={0.5} stopColor={P.paper} stopOpacity={0} /><stop offset={1} stopColor="#E3D6C0" stopOpacity={0.9} /></>);

// ─── The wordmark: two plates that drop in out of register, then settle. ─────

const WORD = "svjeez";
const WORD_SIZE = 440 / (display.measure(WORD, 100) / 100);
const wordW = display.measure(WORD, WORD_SIZE);
const wordX = C - wordW / 2;
const BASE = 600;
const xTop = BASE - (display.metrics.xHeight ?? 0.52) * WORD_SIZE;
const glyphs = display.path(WORD, { size: WORD_SIZE, x: wordX, y: BASE }).glyphs;

const DROP = 1.25;
const letterDrop = (i: number, lag: number) => enter({ at: DROP + lag + i * 0.07, over: 0.55 }, { y: -70, opacity: 0, rotate: (i % 2 ? 1 : -1) * 9 }, ease.pop);
const plate = (color: Color, lag: number, from: { x: number; y: number }, to: { x: number; y: number }) => (
  <g style={multiply} animation={motion(from).at(DROP + 0.5).to(to, 0.9, ease.pop)}>
    <Glyphs font={display} text={WORD} size={WORD_SIZE} x={wordX} y={BASE} fill={color} alt={lag ? "" : undefined} animation={(_, i) => letterDrop(i, lag)} />
  </g>
);
const wordmark = (
  <>
    {plate(P.pink, 0, { x: -18, y: 12 }, { x: 5, y: 4 })}
    {plate(P.blue, 0.06, { x: 16, y: -10 }, { x: 0, y: 0 })}
  </>
);

// ─── Pip, who lives on the z. ────────────────────────────────────────────────

const z = glyphs.at(-1)!;
const pip = { x: z.x + z.advance * 0.5, y: xTop - 2 };
const PIP_AT = DROP + 1.15;
const BLINKS = [5.2, 9.8, 10.15, 14.6, 19.3];
const blink = BLINKS.reduce((m, at) => m.at(at).to({ height: 1.5, y: 4 }, 0.07, ease.in).to({ height: 9, y: 0 }, 0.1), motion({ height: 9, y: 0 }));
const eye = (dx: number) => <rect x={dx - 3} y={-17} width={6} height={9} rx={3} fill={P.ink} animation={blink} />;
const pipNode = (
  <g transform={`translate(${pip.x} ${pip.y})`}>
    <g animation={[enter({ at: PIP_AT, over: 0.5 }, { y: 30, scale: 0, opacity: 0 }, ease.pop), wiggle({ rotate: 5 }, { seed: "pip", rate: 1.5, period: 6 })]}>
      <g animation={motion({ y: 0 }).to({ y: -5 }, 0.5, ease.inOut).to({ y: 0 }, 0.5, ease.inOut).loop(1)}>
        <path d="M-12 -2l-3 6M12 -2l3 6" stroke={P.ink} strokeWidth={3} strokeLinecap="round" />
        <path d="M-28 -2C-30 -28 -14 -40 0 -40S30 -28 28 -2C18 2 -18 2 -28 -2Z" fill={P.sun} stroke={P.ink} strokeWidth={3} strokeLinejoin="round" />
        <path d="M2 -40C4 -50 12 -54 16 -50" fill="none" stroke={P.ink} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={-17} cy={-11} r={4} fill={P.pink} opacity={0.6} />
        <circle cx={17} cy={-11} r={4} fill={P.pink} opacity={0.6} />
        {eye(-8)}
        {eye(8)}
        <path d="M-4 -8Q0 -4 4 -8" fill="none" stroke={P.ink} strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  </g>
);

// ─── Words around the wordmark. ──────────────────────────────────────────────

const HELLO_AT = 0.35;
const hello = (
  <g transform={`rotate(-7 ${wordX} ${xTop - 70})`}>
    <Written text="hello," size={74} x={wordX - 6} y={xTop - 78} at={HELLO_AT} color={P.blue} width={4.5} />
  </g>
);

const TAG = "animated SVG, compiled from TSX";
const TAG_AT = DROP + 1.4;
const tagline = (
  <g animation={enter({ at: TAG_AT, over: 0.6 }, { opacity: 0, y: 10 })}>
    <text x={C} y={BASE + 66} fontFamily={mono} fontSize={18} textAnchor="middle" fill={P.ink}>{TAG}</text>
    <text x={C} y={BASE + 96} fontFamily={mono} fontSize={13} textAnchor="middle" fill={P.ink} opacity={0.6} letterSpacing={1.5}>NO JAVASCRIPT · ONE FILE · PLAYS ANYWHERE</text>
  </g>
);

const CMD = "npm i svjeez";
const CMD_SIZE = 22;
const CMD_Y = BASE + 182;
const CMD_AT = TAG_AT + 0.7;
const cell = mono.measure("m", CMD_SIZE);
const cmdW = cell * (CMD.length + 2);
const cmdX = C - cmdW / 2;
// A marker loop around the command, drawn once and a bit past where it started, the way a hand does it.
const loop = Array.from({ length: 49 }, (_, i) => {
  const a = -2.2 + (i / 48) * (TAU + 0.5);
  const r = 1 + 0.04 * Math.sin(a * 3 + 1);
  return `${i ? "L" : "M"}${(C + 8 + Math.cos(a) * (cmdW / 2 + 44) * r).toFixed(1)} ${(CMD_Y - 8 + Math.sin(a) * 40 * r + i * 0.25).toFixed(1)}`;
}).join("");
const CIRCLE_AT = CMD_AT + 0.2 + CMD.length * 0.07;
const noteAt = CIRCLE_AT + 0.75;
const install = (
  <>
    <text x={cmdX} y={CMD_Y} fontFamily={mono} fontSize={CMD_SIZE} fill={P.pink} animation={enter({ at: CMD_AT, over: 0.3 })}>$</text>
    {[...CMD].map((ch, i) => (
      <text x={cmdX + cell * (i + 2)} y={CMD_Y} fontFamily={mono} fontSize={CMD_SIZE} fill={P.ink} animation={motion({ opacity: 0 }).at(CMD_AT + 0.2 + i * 0.07).set({ opacity: 1 })}>
        {ch}
      </text>
    ))}
    <Stroke d={loop} tool={brush({ size: 5, seed: 4, pressure: 0.5 })} color={P.pink} draw={{ at: CIRCLE_AT, over: 0.7 }} />
    <g transform={`rotate(-4 ${C + 90} ${CMD_Y + 84})`}>
      <Written text="psst, start here" size={30} x={C - 26} y={CMD_Y + 90} at={noteAt + 0.35} color={P.ink} width={2.4} />
    </g>
    <Stroke d={`M${C - 36} ${CMD_Y + 80}C${C - 50} ${CMD_Y + 70} ${C - 54} ${CMD_Y + 52} ${C - 46} ${CMD_Y + 36}M${C - 58} ${CMD_Y + 46}L${C - 46} ${CMD_Y + 34}L${C - 36} ${CMD_Y + 48}`} tool={pencil({ size: 1.8, seed: 2 })} color={P.ink} draw={{ at: noteAt, over: 0.4 }} />
  </>
);

// ─── Doodles in the margins. ─────────────────────────────────────────────────

const boil = fx.boil({ strength: 1.6, rate: 8, detail: 0.05 });

const sun = (x: number, y: number) => (
  <g filter={boil}>
    <g transform={`translate(${x} ${y})`}>
      <g animation={motion({ rotate: 0 }).to({ rotate: 360 }, D, ease.linear).loop(D)}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * TAU;
          const [r1, r2] = i % 2 ? [62, 80] : [62, 92];
          return <path d={`M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2).toFixed(1)}`} stroke={P.ink} strokeWidth={3} strokeLinecap="round" />;
        })}
      </g>
      <circle r={50} fill={P.sun} stroke={P.ink} strokeWidth={3} />
      <path d="M-22 -6q7 -7 14 0M8 -6q7 -7 14 0M-12 14q12 12 24 0" fill="none" stroke={P.ink} strokeWidth={3} strokeLinecap="round" />
      <circle cx={-28} cy={10} r={6} fill={P.pink} opacity={0.55} />
      <circle cx={28} cy={10} r={6} fill={P.pink} opacity={0.55} />
    </g>
  </g>
);

const CLOUD = "M-70 20C-92 20 -96 -8 -74 -12C-76 -38 -40 -46 -28 -26C-20 -52 24 -54 30 -24C46 -40 80 -28 72 -4C94 0 90 20 70 20Z";
const cloud = (x: number, y: number, scale: number, drift: number, phase: number) => (
  <g filter={boil}>
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g animation={sampled((t) => ({ x: drift * Math.sin((TAU * t) / D + phase) }), { duration: D, tolerance: { translate: 0.5 } })}>
        <path d={CLOUD} fill={P.cloud} stroke={P.ink} strokeWidth={3 / scale} strokeLinejoin="round" />
      </g>
    </g>
  </g>
);

const SPARKLE = (r: number) => `M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`;
const SPARK_PERIODS = [3, 4, 6, 8];
const SPARKLE_SPOTS = [
  [170, 300], [1040, 250], [300, 940], [960, 880], [120, 620], [1090, 640], [420, 150], [800, 1050],
  [250, 470], [980, 470], [520, 1080], [700, 120], [150, 860], [1060, 1000], [880, 230], [330, 1120],
] as const;
const sparkles = SPARKLE_SPOTS.map(([x, y], i) => {
  const p = SPARK_PERIODS[i % SPARK_PERIODS.length]!;
  const lead = rand() * (p - 1.4);
  const color = [P.pink, P.blue, P.sun][i % 3]!;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={SPARKLE(9 + rand() * 9)}
        fill={color}
        animation={motion({ scale: 0, rotate: 0 }).wait(lead).to({ scale: 1, rotate: 45 }, 0.45, ease.pop).wait(0.4).to({ scale: 0, rotate: 90 }, 0.5, ease.in).loop(p)}
      />
    </g>
  );
});

// Little squiggles and crosses, the kind that collect in a margin while you think.
const SQUIGGLES = [
  { x: 230, y: 380, color: P.blue, d: "M0 0c10 -14 20 14 30 0s20 14 30 0s20 14 30 0" },
  { x: 900, y: 790, color: P.pink, d: "M0 0c10 -14 20 14 30 0s20 14 30 0" },
  { x: 600, y: 1110, color: P.sun, d: "M0 0q14 -26 28 0t28 0t28 0" },
  { x: 760, y: 210, color: P.blue, d: "M0 0q12 -20 24 0t24 0t24 0" },
  { x: 1080, y: 560, color: P.pink, d: "M0 0l14 14M14 0l-14 14" },
  { x: 180, y: 740, color: P.sun, d: "M0 0l14 14M14 0l-14 14" },
];
const squiggles = SQUIGGLES.map((s, i) => (
  <g transform={`translate(${s.x} ${s.y})`}>
    <g animation={wiggle({ rotate: 8, y: 3 }, { seed: `sq${i}`, rate: 1, period: 8 })}>
      <path d={s.d} fill="none" stroke={s.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={multiply} />
    </g>
  </g>
));

// A paper plane laps the page twice a loop, with a loop-the-loop on the far side each lap.
const ORBIT = { rx: 480, ry: 350, laps: 2 };
const planeAt = (t: number) => {
  const u = (t / D) * ORBIT.laps;
  const a = TAU * u - Math.PI / 2;
  const flourish = Math.exp(-(((u % 1) - 0.62) ** 2) / 0.0012);
  const spin = TAU * Math.min(1, Math.max(0, ((u % 1) - 0.57) / 0.1));
  return {
    x: C + ORBIT.rx * Math.cos(a) + 70 * flourish * Math.sin(spin),
    y: C + ORBIT.ry * Math.sin(a) - 70 * flourish * (1 - Math.cos(spin)),
  };
};
const plane = sampled(
  (t) => {
    const { x, y } = planeAt(t);
    const ahead = planeAt(t + 0.05);
    return { x, y, rotate: (Math.atan2(ahead.y - y, ahead.x - x) * 180) / Math.PI };
  },
  { duration: D, step: 1 / 30, tolerance: { translate: 0.6, rotate: 1.5 } },
);
const flightPath = Array.from({ length: 241 }, (_, i) => {
  const { x, y } = planeAt((i / 240) * (D / ORBIT.laps));
  return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join("");
const planeNode = (
  <>
    <path d={flightPath} fill="none" stroke={P.ink} strokeOpacity={0.28} strokeWidth={1.6} strokeDasharray="2 9" strokeLinecap="round" />
    <g animation={plane}>
      <path d="M22 0L-16 -14L-8 0L-16 14Z" fill={P.cloud} stroke={P.ink} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M22 0L-8 0L-12 8" fill="none" stroke={P.ink} strokeWidth={2} strokeLinejoin="round" />
    </g>
  </>
);

// The front layer bows out just before the loop, so the redraw reads as a fresh page, not a jump.
const OUT = D - 1.1;
const front = motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.8, ease.in);

export default function build(): string {
  return render(
    {
      width: S,
      height: S,
      duration: D,
      title: "svjeez",
      desc: "A sketchbook landing page printed in pink and blue riso ink on warm paper. 'hello,' is handwritten, then the letters of svjeez drop in, wobble and settle into register. A small yellow creature pops up on the z and blinks. A paper plane laps the page with a loop-the-loop, a sleepy sun turns, clouds drift and sparkles pop. Below, the tagline appears, npm i svjeez types in, a pink marker circles it and a note says psst, start here.",
      reducedMotion: { at: 8 },
      comment: "Generated by svjeez. Edit examples/landing/index.tsx instead of this file.",
    },
    <>
      <rect width={S} height={S} fill={P.paper} />
      <rect width={S} height={S} fill={warmth} />
      {planeNode}
      {cloud(190, 470, 1.1, 30, 0)}
      {cloud(1010, 700, 0.85, 24, 2)}
      {cloud(460, 230, 0.75, 20, 4)}
      {cloud(780, 1010, 0.9, 26, 1)}
      {sun(1000, 400)}
      {sun(450, 1060)}
      {sparkles}
      {squiggles}
      <g animation={front}>
        {hello}
        {wordmark}
        {pipNode}
        {tagline}
        {install}
      </g>
      <rect width={S} height={S} filter={tooth} style={multiply} opacity={0.5} />
    </>,
  );
}
