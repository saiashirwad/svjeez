import { Glyphs, Ink, def, draw, ease, enter, font, motion, render, sampled, strokeFont, tool, type Child } from "svjeez";
import { Marker, code, flow, flowchart, morph, typewriter, type CodeRun, type CodeTokens } from "svjeez/extras";
import { CSS, theme } from "./kit";

const W = 960;
const H = 540;
const D = 12;

const display = await font.load(new URL("../fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const mono = await font.load(new URL("../fonts/JetBrainsMono.ttf", import.meta.url), {
  fallback: ["ui-monospace", "Menlo", "monospace"],
  ligatures: false,
});
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

const kw = (text: string): CodeRun => ["keyword", text];
const fn = (text: string, id?: string): CodeRun => (id ? ["fn", text, id] : ["fn", text]);
const p = (text: string): CodeRun => ["punct", text];
const n = (text: string, id?: string): CodeRun => (id ? ["number", text, id] : ["number", text]);
const s = (text: string, id?: string): CodeRun => (id ? ["string", text, id] : ["string", text]);

const rise = (at: number, over = 0.45, y = 12) => enter({ at, over }, { opacity: 0, y }, ease.out);

// ─── Header: Wordmark + CLI command + zero-JS badges ─────────────────────────

const LOGO = "svjeez";
const LOGO_SIZE = 58;
const logoW = display.measure(LOGO, LOGO_SIZE);

const CMD_FS = 13.5;
const CMD_LH = 1.4;
const PILL_H = 38;
const PILL_Y = 22;
const PILL_PAD_X = 20;
const CMD_TEXT = "❯ npx svjeez svg scene.tsx --out scene.svg";
const cmdTextW = mono.measure(CMD_TEXT, CMD_FS);
const PILL_W = Math.round(cmdTextW + PILL_PAD_X * 2);
const PILL_X = W - 24 - PILL_W;

const cmdCode = code(
  [[["blue", "❯"], " npx svjeez svg ", ["string", "scene.tsx"], " --out ", ["fn", "scene.svg"]]],
  {
    theme,
    font: mono,
    fontSize: CMD_FS,
    lineHeight: CMD_LH,
    x: PILL_X + PILL_PAD_X,
    y: PILL_Y + (PILL_H - CMD_FS * CMD_LH) / 2 - 1,
  },
);
const typedCmd = typewriter(cmdCode, { at: 0.55, cps: 38, cursor: theme.base09, blink: false });

const BADGE_FS = 11;
const BADGE_H = 26;
const BADGE_Y = 68;
const BADGE_GAP = 8;
const BADGES = [
  { label: "0 B runtime JS", color: theme.base09 },
  { label: "CSS + SMIL", color: theme.base0B },
  { label: "plays in <img>", color: theme.base0D },
] as const;

const rawContentWidths = BADGES.map((b) => 7 + 7 + mono.measure(b.label, BADGE_FS));
const extraPerBadge = (PILL_W - BADGE_GAP * (BADGES.length - 1) - rawContentWidths.reduce((a, b) => a + b, 0)) / BADGES.length;
const badgeWidths = rawContentWidths.map((cw) => Math.round(cw + extraPerBadge));
badgeWidths[badgeWidths.length - 1] = PILL_W - BADGE_GAP * (BADGES.length - 1) - badgeWidths.slice(0, -1).reduce((a, b) => a + b, 0);
const badgesStartX = PILL_X;

const header = (
  <g>
    <Glyphs
      font={display}
      text={LOGO}
      size={LOGO_SIZE}
      x={28}
      y={76}
      fill="none"
      stroke={theme.base07}
      strokeWidth={1.8}
      animation={(_, i) => draw({ at: 0.08 + i * 0.07, over: 0.5 }, ease.inOut)}
    />
    <Glyphs
      font={display}
      text={LOGO}
      size={LOGO_SIZE}
      x={28}
      y={76}
      fill={theme.base07}
      alt=""
      animation={(_, i) => enter({ at: 0.42 + i * 0.06, over: 0.35 }, { opacity: 0 })}
    />
    <Ink
      d={`M28 90C${28 + logoW * 0.35} 82 ${28 + logoW * 0.7} 96 ${28 + logoW + 8} 86`}
      tool={tool.brush({ size: 5.5, seed: 4 })}
      fill={theme.base09}
      draw={{ at: 0.65, over: 0.45 }}
    />
    <g animation={rise(0.35, 0.4, 8)}>
      <text x={28 + logoW + 22} y={54} fontSize={15.5} fontWeight={700} fill={theme.base06}>
        Animated SVGs in TSX.
      </text>
      <text x={28 + logoW + 22} y={76} fontSize={13.5} fill={theme.base04}>
        One file out. Light &amp; dark ready.
      </text>
    </g>

    <g animation={rise(0.4, 0.4, 8)}>
      <rect x={PILL_X} y={PILL_Y} width={PILL_W} height={PILL_H} rx={PILL_H / 2} fill={theme.base01} stroke={theme.base02} />
    </g>
    <g class="mono">{typedCmd.node}</g>

    {BADGES.map((b, i) => {
      const bw = badgeWidths[i]!;
      const cw = rawContentWidths[i]!;
      const padX = (bw - cw) / 2;
      const bx = badgesStartX + badgeWidths.slice(0, i).reduce((a, w) => a + w + BADGE_GAP, 0);
      const cy = BADGE_Y + BADGE_H / 2;
      return (
        <g animation={rise(0.85 + i * 0.12, 0.35, 6)}>
          <rect x={bx} y={BADGE_Y} width={bw} height={BADGE_H} rx={BADGE_H / 2} fill={theme.base01} stroke={theme.base02} />
          <circle cx={bx + padX + 3.5} cy={cy} r={3.5} fill={b.color} />
          <text x={bx + padX + 14} y={cy + BADGE_FS * 0.33} fontFamily={mono} fontSize={BADGE_FS} fill={theme.base05}>
            {b.label}
          </text>
        </g>
      );
    })}
  </g>
);

// ─── Bento Frame Helper ──────────────────────────────────────────────────────

const Card = ({
  x,
  y,
  w,
  h,
  tag,
  api,
  at,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tag: string;
  api: string;
  at: number;
  children?: Child;
}) => {
  const inner = def.clipPath({}, <rect x={x + 1} y={y + 32} width={w - 2} height={h - 33} rx={11} />);
  return (
    <g animation={rise(at, 0.45, 14)}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={theme.base01} stroke={theme.base02} />
      <path d={`M${x} ${y + 32}H${x + w}`} stroke={theme.base02} />
      <text x={x + 16} y={y + 21} class="mono" fontSize={11} fontWeight={600} fill={theme.base04}>
        {tag}
      </text>
      <text x={x + w - 16} y={y + 21} class="mono" fontSize={11} textAnchor="end" fill={theme.base09}>
        {api}
      </text>
      <g clipPath={inner}>{children}</g>
    </g>
  );
};

// ─── Quadrant 1 (Top-Left): Code & Morph ─────────────────────────────────────

const Q1 = { x: 24, y: 114, w: 444, h: 194 };
const codeOpts = { theme, font: mono, x: Q1.x + 22, y: Q1.y + 52, fontSize: 13, lineHeight: 1.78 };

const v1: CodeTokens = [
  [kw("const"), " chart ", p("="), " ", fn("flowchart", "call"), p("({")],
  ["  nodes", p(": { "), "pr", p(": "), s('"PR"', "arg"), p(", "), "ok", p(": "), s('"Ship"'), p(" },")],
  ["  edges", p(": [["), s('"pr"'), p(", "), s('"ok"'), p("]],")],
  [p("});")],
  [kw("return"), " ", fn("flow", "ret"), p("("), "chart", p("."), fn("route"), p("("), s('"pr"'), p(", "), s('"ok"'), p("));")],
];

const v2: CodeTokens = [
  [kw("const"), " tl ", p("="), " ", fn("timeline", "call"), p("({")],
  ["  intro", p(": "), n("2.4", "arg"), p(", "), "edit", p(": "), n("3.2"), p(", "), "outro", p(": "), n("2.0"), p(",")],
  [p("}, { "), "gap", p(": "), n("0.4"), p(", "), "pace", p(": "), n("1.2"), p(" });")],
  [],
  [kw("return"), " ", fn("morph", "ret"), p("([v1, v2], { "), "at", p(": [tl.edit.at] });")],
];

const beforeCode = code(v1, codeOpts);
const afterCode = code(v2, codeOpts);
const morphed = morph([beforeCode, afterCode, beforeCode], { at: [4.2, 8.8], over: 0.75 });

const q1 = (
  <Card x={Q1.x} y={Q1.y} w={Q1.w} h={Q1.h} tag="01 · EXPLAINERS & MORPH" api="morph() · Marker" at={0.2}>
    <Marker
      theme={theme}
      stops={[
        { during: { at: 0.8, over: 3.1 }, target: beforeCode.get("call").pad(4) },
        { during: { at: 4.3, over: 4.2 }, target: afterCode.get("call").pad(4) },
        { during: { at: 8.9, over: 2.3 }, target: beforeCode.get("ret").pad(4) },
      ]}
    />
    <g class="mono">{morphed.node}</g>
  </Card>
);

// ─── Quadrant 2 (Top-Right): Typed Diagrams & Flow ───────────────────────────

const Q2 = { x: 492, y: 114, w: 444, h: 194 };
const chart = flowchart(
  {
    nodes: {
      tsx: { label: "scene.tsx", role: "input" },
      compile: { label: "compile", role: "tool" },
      check: { label: "valid?", role: "decision" },
      svg: { label: "scene.svg", role: "output" },
    },
    edges: [
      ["tsx", "compile"],
      ["compile", "check"],
      ["check", "svg", { label: "ok" }],
      ["check", "compile", { label: "fix" }],
    ],
  },
  {
    theme,
    font: mono,
    fontSize: 12.5,
    direction: "LR",
    x: 0,
    y: 0,
    anchor: "center",
    play: { at: 0.8, step: 0.28 },
  },
);

const routePts = chart.route("tsx", "svg");
const trace1 = flow(routePts, { theme, at: 2.3, over: 1.4, style: "comet", arrive: true, color: theme.base09 });
const trace2 = flow(routePts, { theme, at: 6.4, over: 1.4, style: "trace", arrive: true, color: theme.base0B });
const q2Scale = Math.min(1, (Q2.w - 44) / chart.bounds.w, (Q2.h - 56) / chart.bounds.h);

const q2 = (
  <Card x={Q2.x} y={Q2.y} w={Q2.w} h={Q2.h} tag="02 · TYPED DIAGRAMS" api="flowchart() · flow()" at={0.3}>
    <g transform={`translate(${Q2.x + Q2.w / 2} ${Q2.y + 32 + (Q2.h - 32) / 2}) scale(${q2Scale.toFixed(3)})`}>
      {chart.layers.under}
      {trace1.node}
      {trace2.node}
      {chart.layers.over}
    </g>
  </Card>
);

// ─── Quadrant 3 (Bottom-Left): Ink, Fonts & Calligraphy ──────────────────────

const Q3 = { x: 24, y: 324, w: 444, h: 192 };
const PHRASE = "Write anything.";
const PHRASE_SIZE = 54;
const phraseW = hand.measure(PHRASE, PHRASE_SIZE);
const phraseX = Q3.x + (Q3.w - phraseW) / 2;
const phraseY = Q3.y + 114;

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;
  for (let i = 2; i + 1 < xy.length; i += 2) sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);
  return sum;
};

const strokes = hand
  .path(PHRASE, { size: PHRASE_SIZE, x: phraseX, y: phraseY })
  .d.split(/(?=M)/)
  .reduce<{ d: string; at: number; over: number }[]>((out, d) => {
    const at = out.length ? out.at(-1)!.at + out.at(-1)!.over + 0.03 : 1.2;
    return [...out, { d, at, over: Math.max(0.06, lengthOf(d) / 680) }];
  }, []);

const inkDone = strokes.at(-1)!.at + strokes.at(-1)!.over;
const nib = tool.nib({ size: 3.8, angle: 35, thin: 0.25 });

const q3 = (
  <Card x={Q3.x} y={Q3.y} w={Q3.w} h={Q3.h} tag="03 · INK & TYPOGRAPHY" api="<Ink> · strokeFont" at={0.4}>
    <path d={`M${Q3.x + 36} ${phraseY + 8}H${Q3.x + Q3.w - 36}`} stroke={theme.base02} strokeDasharray="3 5" />
    <path d={`M${Q3.x + 36} ${phraseY - 34}H${Q3.x + Q3.w - 36}`} stroke={theme.base02} strokeOpacity={0.5} strokeDasharray="2 6" />
    {strokes.map(({ d, at, over }) => (
      <Ink d={d} tool={nib} fill={theme.base07} draw={{ at, over }} ease={ease.linear} />
    ))}
    <Ink
      d={`M${phraseX + 12} ${phraseY + 26}C${Q3.x + Q3.w * 0.38} ${phraseY + 14} ${Q3.x + Q3.w * 0.65} ${phraseY + 34} ${phraseX + phraseW - 8} ${phraseY + 20}`}
      tool={tool.brush({ size: 4.8, seed: 7 })}
      fill={theme.base08}
      draw={{ at: inkDone + 0.15, over: 0.55 }}
    />
    <g animation={rise(inkDone + 0.4, 0.4, 6)}>
      <text x={Q3.x + Q3.w / 2} y={Q3.y + 168} class="mono" fontSize={11.5} textAnchor="middle" fill={theme.base04}>
        pressure-varied nib, brush &amp; pen strokes · subsetted TTF/OTF
      </text>
    </g>
  </Card>
);

// ─── Quadrant 4 (Bottom-Right): Sampled Physics & Waveforms ──────────────────

const Q4 = { x: 492, y: 324, w: 444, h: 192 };
const SPRING = {
  at: 1.0,
  over: 9.2,
  amp: 46,
  massX: Q4.x + 64,
  midY: Q4.y + 118,
  plotX: Q4.x + 126,
  plotW: 288,
};

const springY = (t: number) => {
  const s = Math.min(Math.max(t - SPRING.at, 0), SPRING.over);
  return -SPRING.amp * Math.exp(-0.42 * s) * Math.cos(2 * Math.PI * 0.95 * s);
};

const plotX = (t: number) => SPRING.plotX + (Math.min(Math.max(t - SPRING.at, 0), SPRING.over) / SPRING.over) * SPRING.plotW;

const wavePath = Array.from({ length: 181 }, (_, i) => SPRING.at + (i / 180) * SPRING.over)
  .map((t, i) => `${i ? "L" : "M"}${plotX(t).toFixed(1)} ${(SPRING.midY + springY(t)).toFixed(1)}`)
  .join("");

const weightMotion = sampled((t) => ({ y: springY(t) }), { duration: D, step: 1 / 50, tolerance: { translate: 0.4 } });
const playheadMotion = sampled((t) => ({ x: plotX(t), y: SPRING.midY + springY(t) }), { duration: D, step: 1 / 50, tolerance: { translate: 0.4 } });
const plotReveal = def.clipPath(
  {},
  <rect
    x={SPRING.plotX - 2}
    y={Q4.y + 34}
    width={2}
    height={Q4.h - 36}
    animation={motion({ width: 2 }).at(SPRING.at).to({ width: SPRING.plotW + 6 }, SPRING.over, ease.linear)}
  />,
);
const springClip = def.clipPath({}, <rect x={SPRING.massX - 36} y={Q4.y + 48} width={72} height={136} />);

const q4 = (
  <Card x={Q4.x} y={Q4.y} w={Q4.w} h={Q4.h} tag="04 · SAMPLED PHYSICS" api="sampled(t => fn(t))" at={0.5}>
    {/* Ceiling anchor + spring weight */}
    <path d={`M${SPRING.massX - 22} ${Q4.y + 48}H${SPRING.massX + 22}`} stroke={theme.base03} strokeWidth={2} strokeLinecap="round" />
    <g clipPath={springClip}>
      <g animation={weightMotion}>
        <path d={`M${SPRING.massX} ${SPRING.midY - 120}V${SPRING.midY}`} stroke={theme.base04} strokeWidth={1.8} strokeDasharray="3 3" />
        <rect x={SPRING.massX - 18} y={SPRING.midY - 18} width={36} height={36} rx={8} fill={theme.base0D} />
        <circle cx={SPRING.massX} cy={SPRING.midY} r={4} fill={theme.base01} />
      </g>
    </g>

    {/* Equilibrium axis & grid */}
    <path d={`M${SPRING.plotX} ${Q4.y + 56}V${Q4.y + 172}`} stroke={theme.base02} />
    <path d={`M${SPRING.plotX} ${SPRING.midY}H${SPRING.plotX + SPRING.plotW}`} stroke={theme.base03} strokeDasharray="3 5" />

    {/* Traced waveform + live playhead */}
    <g clipPath={plotReveal}>
      <path d={wavePath} fill="none" stroke={theme.base09} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g animation={[enter({ at: SPRING.at, over: 0.2 }, { scale: 0 }), playheadMotion]}>
      <circle r={8} fill={theme.base09} opacity={0.22} />
      <circle r={4} fill={theme.base09} />
    </g>
    <text x={SPRING.plotX + SPRING.plotW} y={Q4.y + 172} class="mono" fontSize={10.5} textAnchor="end" fill={theme.base04}>
      RDP keyframe simplification
    </text>
  </Card>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez: animated SVGs in TSX",
      desc: "The svjeez wordmark inks on above a four-quadrant showcase: code morphing with a gliding marker, a typed flowchart traced by comets, hand-inked calligraphy written stroke by stroke, and a damped spring physics simulation plotted in real time.",
      css: CSS,
      reducedMotion: { at: 9.5 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} rx={16} />
      <g animation={motion({ opacity: 1 }).at(D - 0.55).to({ opacity: 0 }, 0.45)}>
        {header}
        {q1}
        {q2}
        {q3}
        {q4}
      </g>
    </>,
  );
}
