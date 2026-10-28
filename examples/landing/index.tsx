import { type Color, type Motion, type SvgNode, Stroke, draw, ease, enter, font, motion, nib, pencil, render, shake, strokeFont, type Tool } from "svjeez";

// A pencil test: one sheet of animation paper on a peg bar, and a ball learning to bounce.
// On svjeez.texoport.in the page swaps time for scroll, so the scrollbar is the playhead.
// Anything in an `idle` group keeps playing on the clock, so the sheet still breathes when the
// reader stops; anything in a `once` group plays once on load. Everything else is the story.
// A `scrollonly` group talks about scrolling, so the page hides it when it can't scrub.
const S = 1000;
const D = 60;
const FPS = 12;

const mono = await font.load(new URL("../fonts/JetBrainsMono.ttf", import.meta.url), { fallback: ["ui-monospace", "Menlo", "monospace"], ligatures: false });
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

const P = {
  paper: "#FBF7EE",
  card: "#FFFDF7",
  lead: "#2E2B36",
  blue: "#3F6FE8",
  ghost: "#9DB4F2",
  red: "#E5383B",
  ball: "#FF9F43",
  marker: "#FFE45C",
} as const satisfies Record<string, Color>;

const lead = (size: number, seed = 1) => pencil({ size, seed });

// ─── Handwriting. ────────────────────────────────────────────────────────────

/** Roughly how far the pen travels: along the control polygon, close enough to pace the writing. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;
  for (let i = 2; i + 1 < xy.length; i += 2) sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);
  return sum;
};

type Hand = { text: string; size: number; x: number; y: number; at: number; color: Color; tool: Tool; speed?: number; align?: "left" | "center" };

/** Handwriting, one pen stroke after another at one speed, or already there when `at` is negative. Returns the time the pen lifts. */
const write = ({ text, size, x, y, at, color, tool, speed = 1100, align = "left" }: Hand): { node: SvgNode; done: number } => {
  const left = align === "center" ? x - hand.measure(text, size) / 2 : x;
  const strokes = hand
    .path(text, { size, x: left, y })
    .d.split(/(?=M)/)
    .reduce<{ d: string; at: number; over: number }[]>((out, d) => {
      const start = out.length ? out.at(-1)!.at + out.at(-1)!.over + 0.01 : at;
      return [...out, { d, at: start, over: Math.max(0.03, lengthOf(d) / speed) }];
    }, []);
  const last = strokes.at(-1)!;
  return {
    node: (
      <g aria-label={text}>
        {strokes.map((s) => (
          <Ink d={s.d} tool={tool} color={color} draw={at < 0 ? undefined : { at: s.at, over: s.over }} />
        ))}
      </g>
    ),
    done: last.at + last.over,
  };
};
const Written = (props: Hand) => write(props).node;

/**
 * A mark inked on along its path. While the pen moves it is a plain dashed stroke; when the pen lifts,
 * the tool's outline takes its place. `<Stroke draw>` reveals through a mask instead, and hundreds of
 * masks are too slow to repaint on every scroll frame.
 */
const Ink = ({ d, tool, color, draw: span, opacity }: { d: string; tool: Tool; color: Color; draw?: { at: number; over: number }; opacity?: number }) => {
  if (!span) return <Stroke d={d} tool={tool} color={color} opacity={opacity} />;
  const lift = span.at + span.over;
  return (
    <>
      <g animation={motion({ opacity: 1 }).at(lift).set({ opacity: 0 })}>
        <path d={d} fill="none" stroke={color} strokeWidth={tool.size * 0.7} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} animation={draw(span, ease.linear)} />
      </g>
      <Stroke d={d} tool={tool} color={color} opacity={opacity} animation={motion({ opacity: 0 }).at(lift).set({ opacity: 1 })} />
    </>
  );
};

/** A pencil line drawn on over a span. */
const Line = ({ d, at, over, color = P.lead, size = 2.2, seed = 1 }: { d: string; at: number; over: number; color?: Color; size?: number; seed?: number }) => (
  <Ink d={d} tool={lead(size, seed)} color={color} draw={{ at, over }} />
);

/** Leaves the page: a lift and a fade, the way an eraser takes a line. */
const leave = (at: number, over = 0.5, y = -24) => motion({ opacity: 1, y: 0 }).at(at).to({ opacity: 0, y }, over, ease.in);
/** On at a moment, off at another, with no fade: a drawing swapped on the peg bar. */
const shown = (from: number, until = D + 1) => {
  const m = motion({ opacity: from <= 0 ? 1 : 0 });
  const on = from <= 0 ? m : m.at(from).set({ opacity: 1 });
  return until > D ? on : on.at(until).set({ opacity: 0 });
};

const circlePath = (cx: number, cy: number, rx: number, ry = rx, start = -2.2, turns = 1.08) => {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const a = start + (i / 40) * turns * Math.PI * 2;
    return `${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join("L")}`;
};

// ─── The ball's path. ────────────────────────────────────────────────────────
// One function of story time gives where the ball is and which drawing is on the pegs.

type Shape = "round" | "squash" | "stretch";
type Pose = { x: number; y: number; shape: Shape };
const GROUND = 720;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/** A hop between two points, peaking `lift` above the higher one. */
const hop = (from: [number, number], to: [number, number], lift: number) => (u: number): [number, number] => [lerp(from[0], to[0], u), lerp(from[1], to[1], u) - lift * 4 * u * (1 - u)];

type Leg = { at: number; over: number; path: (u: number) => [number, number] };
const START: [number, number] = [160, 250];
const BOUNCES = [
  { x: 330, h: 0, over: 0.8 }, // the fall from the first key
  { x: 520, h: 330, over: 1.1 },
  { x: 670, h: 200, over: 0.85 },
  { x: 780, h: 110, over: 0.6 },
  { x: 850, h: 50, over: 0.4 },
];
const fall = (from: [number, number], x: number) => (u: number): [number, number] => [lerp(from[0], x, u), lerp(from[1], GROUND, u * u)];
const legs: Leg[] = [];
const leg = (at: number, over: number, path: Leg["path"]) => legs.push({ at, over, path });

leg(3.4, 1.0, hop([500, GROUND], START, 160));
{
  let at = 4.8;
  let x = START[0];
  for (const b of BOUNCES) {
    const from = x;
    leg(at, b.over, b.h ? (u) => [lerp(from, b.x, u), GROUND - b.h * 4 * u * (1 - u)] : fall(START, b.x));
    at += b.over;
    x = b.x;
  }
  leg(at, 0.4, (u) => [lerp(850, 880, Math.sin((u * Math.PI) / 2)), GROUND]);
}
// The code chapter: up to the top of the bounce, then fall and rise in time with the highlighted lines.
const TOP = 300;
const BX = 820;
leg(15.6, 0.8, hop([880, GROUND], [BX, TOP], 40));
const HALF = 1;
const BEATS = [16.4, 18.4];
for (const at of BEATS) {
  leg(at, HALF, (u) => [BX, lerp(TOP, GROUND, u * u)]);
  leg(at + HALF, HALF, (u) => [BX, lerp(GROUND, TOP, 1 - (1 - u) * (1 - u))]);
}
leg(20.4, 0.6, (u) => [BX, lerp(TOP, GROUND, u * u)]);
// Out of the way of the machine, then back to the middle for the bow.
const WATCH: [number, number] = [190, GROUND];
leg(22.4, 0.9, hop([BX, GROUND], WATCH, 180));
const BOW: [number, number] = [500, 600];
leg(45, 1.2, hop(WATCH, BOW, 260));

const at = (t: number): [number, number] => {
  let pos: [number, number] = [500, GROUND];
  for (const l of legs) {
    if (t < l.at) break;
    pos = l.path(clamp01((t - l.at) / l.over));
  }
  return pos;
};
const pose = (t: number): Pose => {
  const [x, y] = at(t);
  const dt = 1 / FPS;
  const vy = (at(t + dt / 2)[1] - at(t - dt / 2)[1]) / dt;
  const onGround = y >= GROUND - 2 && t > 4.5 && t < 45;
  const fast = Math.abs(vy) > 520 && y > GROUND - 160;
  return { x, y, shape: onGround && Math.abs(vy) > 80 ? "squash" : fast ? "stretch" : "round" };
};

// The ball moves on twos, like a pencil test: one new drawing every 1/12 of a story second.
const frames = Array.from({ length: D * FPS + 1 }, (_, i) => ({ t: i / FPS, ...pose(i / FPS) }));
// Contacts land on a frame of their own, so every bounce shows its squash.
for (const l of legs) {
  const end = l.at + l.over;
  const [x, y] = l.path(1);
  if (y >= GROUND - 1 && l.over >= 0.4 && end > 4.5 && end < 44) {
    const i = frames.findIndex((f) => f.t > end - 1e-6);
    frames.splice(i, 0, { t: end, x, y, shape: "squash" }, { t: end + 1 / FPS / 2, x, y, shape: "round" });
  }
}
frames.sort((a, b) => a.t - b.t);

const stepped = <K extends "x" | "y" | "opacity">(keys: (f: Pose & { t: number }) => Record<K, number>): Motion<K> => {
  // Keys come from the caller, so the exact-keys check cannot see them; K names them instead.
  let m = motion(keys(frames[0]!) as {}) as Motion<K>;
  let last = JSON.stringify(keys(frames[0]!));
  let cursor = 0;
  for (const f of frames.slice(1)) {
    const v = keys(f);
    const s = JSON.stringify(v);
    if (s === last || f.t <= cursor) continue;
    m = m.at(f.t).set(v as {}) as Motion<K>;
    last = s;
    cursor = f.t;
  }
  return m;
};

// ─── The ball itself. ────────────────────────────────────────────────────────

const R = 40;
const SHAPES: Record<Shape, { rx: number; ry: number; cy: number }> = {
  round: { rx: R, ry: R, cy: 0 },
  squash: { rx: 52, ry: 27, cy: 13 },
  stretch: { rx: 31, ry: 50, cy: -6 },
};

const Eyes = ({ cy, open }: { cy: number; open: boolean }) =>
  open ? (
    <g class="idle">
      <g animation={motion({ opacity: 1 }).at(2.8).set({ opacity: 0 }).wait(0.14).set({ opacity: 1 }).loop(3)}>
        <ellipse cx={-11} cy={cy - 6} rx={4.4} ry={7} fill={P.lead} />
        <ellipse cx={11} cy={cy - 6} rx={4.4} ry={7} fill={P.lead} />
        <circle cx={-9.5} cy={cy - 9} r={1.6} fill={P.card} />
        <circle cx={12.5} cy={cy - 9} r={1.6} fill={P.card} />
      </g>
      <g animation={motion({ opacity: 0 }).at(2.8).set({ opacity: 1 }).wait(0.14).set({ opacity: 0 }).loop(3)}>
        <path d={`M-16 ${cy - 5}h10M6 ${cy - 5}h10`} stroke={P.lead} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </g>
  ) : (
    <path d={`M-16 ${cy - 6}q5 5 10 0M6 ${cy - 6}q5 5 10 0`} fill="none" stroke={P.lead} strokeWidth={2.6} strokeLinecap="round" />
  );

const Drawing = ({ shape, open }: { shape: Shape; open: boolean }) => {
  const { rx, ry, cy } = SHAPES[shape];
  return (
    <>
      <ellipse cx={0} cy={cy} rx={rx} ry={ry} fill={P.ball} />
      <path d={`M${-rx * 0.55} ${cy + ry * 0.45}Q0 ${cy + ry * 1.05} ${rx * 0.6} ${cy + ry * 0.4}`} fill="none" stroke="#E07A1F" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
      <ellipse cx={-rx * 0.42} cy={cy - ry * 0.52} rx={rx * 0.2} ry={ry * 0.12} fill={P.card} opacity={0.8} transform={`rotate(-30 ${-rx * 0.42} ${cy - ry * 0.52})`} />
      <Stroke d={circlePath(0, cy, rx, ry, -2.4, 1.04)} tool={lead(2.3, 3)} color={P.lead} />
      <g transform={`scale(${rx / R} ${ry / R})`}>
        <Eyes cy={cy * (R / ry)} open={open} />
      </g>
      <path d={`M-12 ${cy + ry * 0.3}q-4 -1 -6 1M12 ${cy + ry * 0.3}q4 -1 6 1`} fill="none" stroke="#F2667A" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
    </>
  );
};

const WAKE = 2.2;
const ball = (
  <g animation={stepped((f) => ({ x: f.x, y: f.y }))}>
    <g animation={motion({ scale: 1 }).at(45).to({ scale: 1.6 }, 1.2, ease.steps(10))}>
      <g animation={motion({ rotate: 0 }).at(46.6).to({ rotate: -16 }, 0.4, ease.steps(4)).wait(0.3).to({ rotate: 0 }, 0.4, ease.steps(4))}>
        <g animation={motion({ opacity: 1 }).at(WAKE).set({ opacity: 0 })}>
          <Drawing shape="round" open={false} />
        </g>
        {(["round", "squash", "stretch"] as const).map((shape) => (
          <g animation={stepped((f) => ({ opacity: f.t >= WAKE && f.shape === shape ? 1 : 0 }))}>
            <Drawing shape={shape} open />
          </g>
        ))}
      </g>
    </g>
  </g>
);

// Before the wake: zzz, idling on the clock. After: a startled "!".
const zzz = (
  <g transform={`translate(536 ${GROUND - 50})`} animation={motion({ opacity: 1 }).at(WAKE).set({ opacity: 0 })}>
    {[0, 1, 2].map((i) => (
      <g class="idle">
        <g animation={motion({ x: 0, y: 0, opacity: 0 }).at(i * 0.6).to({ opacity: 1 }, 0.3).to({ x: 26, y: -60, opacity: 0 }, 1.4, ease.inOut).loop(3)}>
          <Written text="z" size={26 + i * 6} x={0} y={0} at={-1} color={P.blue} tool={lead(1.8, 9 + i)} />
        </g>
      </g>
    ))}
  </g>
);
const bang = (
  <g transform={`translate(550 ${GROUND - 70})`} animation={[enter({ at: WAKE, over: 0.25 }, { scale: 0 }, ease.pop), leave(WAKE + 1.1, 0.3)]}>
    <path d="M0 -40L-4 -6" stroke={P.red} strokeWidth={5} strokeLinecap="round" />
    <circle cx={-5} cy={6} r={3.4} fill={P.red} />
  </g>
);

// ─── Chapter 0: the title page. ──────────────────────────────────────────────

const TITLE_AT = 0.3;
const title = write({ text: "svjeez", size: 210, x: S / 2, y: 400, at: TITLE_AT, color: P.lead, tool: nib({ size: 13, angle: 32, thin: 0.22 }), speed: 2600, align: "center" });
const tagline = write({ text: "draw in TSX, get one animated SVG", size: 38, x: S / 2, y: 512, at: title.done - 0.5, color: P.blue, tool: lead(1.9, 4), speed: 1800, align: "center" });
const titleNode = (
  <g animation={leave(2.9, 0.5, -60)}>
    <g class="once">
      {title.node}
      {tagline.node}
      <Ink d={`M${S / 2 - 210} 425C${S / 2 - 60} 412 ${S / 2 + 90} 418 ${S / 2 + 230} 410`} tool={lead(3.2, 8)} color={P.red} draw={{ at: title.done - 0.2, over: 0.4 }} />
    </g>
  </g>
);
const scrollHint = (
  <g class="scrollonly" animation={leave(2.0, 0.4, 10)}>
    <g class="once">
      <g animation={enter({ at: tagline.done + 0.2, over: 0.5 })}>
        <Written text="scroll. you're holding the playhead" size={26} x={S / 2} y={575} at={tagline.done + 0.2} color={P.red} tool={lead(1.6, 6)} speed={1000} align="center" />
        <g class="idle" transform="translate(500 612)">
          <g animation={motion({ y: 0 }).to({ y: 8 }, 0.6, ease.inOut).to({ y: 0 }, 0.6, ease.inOut).loop(1.2)}>
            <Stroke d="M0 0L0 34M-10 24L0 36L10 24" tool={lead(2, 2)} color={P.red} />
          </g>
        </g>
      </g>
    </g>
  </g>
);
const ground = (
  <g animation={leave(10.6, 0.6, 0)}>
    <Stroke d={`M330 ${GROUND + R + 2}C450 ${GROUND + R} 560 ${GROUND + R + 4} 680 ${GROUND + R + 1}`} tool={lead(1.6, 12)} color={P.lead} />
  </g>
);

// ─── Chapter 1: keys and in-betweens. ────────────────────────────────────────

const BOUNCE_FROM = 3.4;
const BOUNCE_TO = 10.2;
const ghostFrames = frames.filter((f, i) => f.t >= 4.4 && f.t <= BOUNCE_TO && i % 2 === 0);
// The keys an animator would draw first: where the ball starts, then each contact and the top of each arc.
const bounceLegs = legs.filter((l) => l.at >= 4.8 && l.at < 9.5);
const keys = [
  { t: 4.4, contact: false },
  ...bounceLegs.flatMap((l, i) => [...(i ? [{ t: l.at + l.over / 2, contact: false }] : []), { t: l.at + l.over, contact: true }]),
]
  .slice(0, 7)
  .map(({ t, contact }, i) => ({ t, n: i + 1, ...pose(t), shape: (contact ? "squash" : "round") as Shape }));

const ghostShape = (f: Pose, color: Color, width: number, dash?: string) => {
  const { rx, ry, cy } = SHAPES[f.shape];
  return <ellipse cx={f.x} cy={f.y + cy} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} />;
};
const trail = legs
  .filter((l) => l.at >= 4.8 && l.at < 10)
  .map((l, i) => {
    const pts = Array.from({ length: 25 }, (_, k) => l.path(k / 24));
    const d = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}`;
    return <path d={d} fill="none" stroke={P.ghost} strokeWidth={1.5} strokeLinecap="round" animation={draw({ at: l.at, over: l.over }, ease.linear)} key={String(i)} />;
  });
const keysCaption = write({ text: "you draw the keys", size: 46, x: S / 2, y: 150, at: 5.0, color: P.lead, tool: lead(2.4, 21), align: "center" });
const tweensCaption = write({ text: "svjeez draws every frame in between", size: 34, x: S / 2, y: 205, at: 7.4, color: P.blue, tool: lead(2, 22), align: "center" });
const chapterKeys = (
  <g animation={leave(10.6, 0.6, -10)}>
    {ghostFrames.map((f) => (
      <g animation={motion({ opacity: 0 }).at(f.t).set({ opacity: 0.75 })}>{ghostShape(f, P.ghost, 1.6)}</g>
    ))}
    {trail}
    {keys.map((k) => (
      <g animation={motion({ opacity: 0 }).at(k.t + 0.08).set({ opacity: 1 })}>
        {ghostShape(k, P.lead, 1.4, "5 4")}
        <g transform={`translate(${k.x + (k.shape === "squash" ? 0 : 54)} ${k.y + (k.shape === "squash" ? 72 : -40)})`}>
          <Ink d={circlePath(0, -8, 17)} tool={lead(1.6, 30 + k.n)} color={P.red} draw={{ at: k.t + 0.1, over: 0.25 }} />
          <Written text={String(k.n)} size={22} x={0} y={0} at={k.t + 0.12} color={P.red} tool={lead(1.8, 40 + k.n)} align="center" speed={600} />
        </g>
      </g>
    ))}
    {keysCaption.node}
    {tweensCaption.node}
  </g>
);

// ─── Chapter 2: the code on an index card. ───────────────────────────────────

type Tok = [string, Color];
const k = (s: string): Tok => [s, P.blue];
const n = (s: string): Tok => [s, P.red];
const p = (s: string): Tok => [s, P.lead];
const CODE: Tok[][] = [
  [p("<"), k("Ball"), p(" animation={")],
  [p("  motion({ y: "), n("0"), p(" })")],
  [p("    .to({ y: "), n("420"), p(" }, "), n("0.5"), p(", ease."), k("in"), p(")")],
  [p("    .to({ y: "), n("0"), p(" }, "), n("0.5"), p(", ease."), k("out"), p(")")],
  [p("    .loop("), n("1"), p(")")],
  [p("} />")],
];
const CARD = { x: 70, y: 175, w: 560, h: 380 };
const CODE_SIZE = 22;
const CODE_X = CARD.x + 40;
const LINE = 46;
const codeY = (i: number) => CARD.y + 110 + i * LINE;
const TYPE_AT = 12.6;
const CHAR = 0.022;
let typed = TYPE_AT;
const codeLines = CODE.map((toks, i) => {
  const text = toks.map(([s]) => s).join("");
  const at = typed;
  typed += text.length * CHAR + 0.12;
  const width = mono.measure(text, CODE_SIZE);
  return (
    <g>
      <text x={CODE_X} y={codeY(i)} fontFamily={mono} fontSize={CODE_SIZE} class="pre">
        {toks.map(([s, fill]) => (
          <tspan fill={fill}>{s}</tspan>
        ))}
      </text>
      {/* A strip of card slides off the line, one character at a time, like a typewriter. */}
      <rect x={CODE_X - 2} y={codeY(i) - 24} width={width + 8} height={30} fill={P.card} animation={motion({ x: 0, width: width + 8, opacity: 1 }).at(at).to({ x: width + 4, width: 4 }, text.length * CHAR, ease.steps(text.length)).set({ opacity: 0 })} />
    </g>
  );
});
const marker = (line: number, from: number, until: number, seed: number) => {
  const y = codeY(line) - 7;
  const w = mono.measure(CODE[line]!.map(([s]) => s).join(""), CODE_SIZE);
  return (
    <g animation={motion({ opacity: 0 }).at(from).set({ opacity: 1 }).at(until).set({ opacity: 0 })}>
      <Ink d={`M${CODE_X + 40} ${y}L${CODE_X + w + 6} ${y - 2}`} tool={{ ...pencil({ size: 26, seed }), size: 26 }} color={P.marker} opacity={0.85} draw={{ at: from, over: 0.25 }} />
    </g>
  );
};
const loopNote = write({ text: "forever", size: 30, x: CODE_X + 210, y: codeY(4) + 6, at: 19.0, color: P.red, tool: lead(1.8, 51) });
const wholeBounce = write({ text: "that's the whole bounce.", size: 40, x: CARD.x + 20, y: 650, at: 20.9, color: P.lead, tool: lead(2.3, 52) });
const tape = (x: number, y: number, r: number) => <rect x={x - 38} y={y - 13} width={76} height={26} fill="#E9DFC4" opacity={0.85} transform={`rotate(${r} ${x} ${y})`} />;
const chapterCode = (
  <g animation={leave(22.5, 0.4, 0)}>
    <g animation={motion({ x: -700, y: 0, scale: 1, rotate: 0, opacity: 1 }).at(11.4).to({ x: 0 }, 0.9, ease.out).at(22.9).to({ x: 520, y: -10, scale: 0.08, rotate: 200 }, 1.0, ease.in).set({ opacity: 0 })}>
      <g transform={`rotate(-2 ${CARD.x + CARD.w / 2} ${CARD.y + CARD.h / 2})`}>
        <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} rx={4} fill={P.card} stroke="#E5DCC8" strokeWidth={1.5} />
        <line x1={CARD.x} x2={CARD.x + CARD.w} y1={CARD.y + 62} y2={CARD.y + 62} stroke="#F08A8A" strokeWidth={1.6} />
        {CODE.map((_, i) => <line x1={CARD.x} x2={CARD.x + CARD.w} y1={codeY(i) + 12} y2={codeY(i) + 12} stroke="#B9CBF2" strokeWidth={1} />)}
        <Written text="bounce.tsx" size={30} x={CARD.x + 30} y={CARD.y + 46} at={12.2} color={P.lead} tool={lead(1.8, 50)} />
        {marker(2, 16.4, 17.4, 61)}
        {marker(3, 17.4, 18.4, 62)}
        {marker(2, 18.4, 19.4, 63)}
        {marker(3, 19.4, 20.4, 64)}
        {codeLines}
        <Ink d={circlePath(CODE_X + 118, codeY(4) - 8, 70, 22, -2.6, 1.1)} tool={lead(2, 53)} color={P.red} draw={{ at: 18.6, over: 0.35 }} />
        {loopNote.node}
        {tape(CARD.x + 30, CARD.y + 2, -24)}
        {tape(CARD.x + CARD.w - 30, CARD.y + 2, 22)}
      </g>
    </g>
    {wholeBounce.node}
    {/* Rulers at the ball's two values, so the code and the motion line up. */}
    <g animation={enter({ at: 16.2, over: 0.4 })}>
      <path d={`M${BX + 60} ${TOP}h50M${BX + 60} ${GROUND}h50`} stroke={P.blue} strokeWidth={1.5} strokeDasharray="4 5" />
      <Written text="y: 0" size={22} x={BX + 62} y={TOP - 10} at={16.2} color={P.blue} tool={lead(1.4, 54)} />
      <Written text="y: 420" size={22} x={BX + 54} y={GROUND - 10} at={16.4} color={P.blue} tool={lead(1.4, 55)} />
    </g>
  </g>
);

// ─── Chapter 3: through the machine. ─────────────────────────────────────────

const MACHINE_AT = 22.6;
const CRANK = { at: 24.0, over: 2.0 };
const OUT_AT = CRANK.at + CRANK.over;
const FILE: [number, number] = [865, 585];
const strikes = ["javascript", "a runtime", "a video file", "dependencies"];
const listAt = OUT_AT + 0.9;
const machine = (
  <g animation={leave(33, 0.5, 20)}>
    <g animation={shake({ at: CRANK.at, over: CRANK.over }, { x: 5 })}>
      <Line d="M520 360L720 362L700 420L540 418Z" at={MACHINE_AT} over={0.4} seed={70} />
      <Line d="M545 420C540 480 538 560 542 650L702 652C706 560 704 480 698 420" at={MACHINE_AT + 0.3} over={0.5} seed={71} size={2.6} />
      <Line d="M702 560L782 572L780 618L702 616" at={MACHINE_AT + 0.7} over={0.3} seed={72} />
      <Line d="M560 652L556 690M686 652L690 690" at={MACHINE_AT + 0.9} over={0.2} seed={73} />
      <Ink d={circlePath(620, 490, 30)} tool={lead(2, 74)} color={P.lead} draw={{ at: MACHINE_AT + 0.8, over: 0.3 }} />
      <g animation={enter({ at: MACHINE_AT + 1.0, over: 0.2 })}>
        <g transform="translate(620 490)">
        <g animation={motion({ rotate: -50 }).at(CRANK.at).to({ rotate: 60 }, 0.5, ease.inOut).to({ rotate: -20 }, 0.5, ease.inOut).to({ rotate: 80 }, 0.5, ease.inOut).to({ rotate: 30 }, 0.5, ease.pop)}>
          {/* Drawn through the axle and half dashed away, so it turns about the axle. */}
          <path d="M0 -24V24" stroke={P.red} strokeWidth={3} strokeDasharray="24 24" />
        </g>
        </g>
      </g>
      <Written text="svjeez" size={34} x={622} y={590} at={MACHINE_AT + 1.0} color={P.blue} tool={lead(1.8, 75)} align="center" speed={1400} />
      <Written text="tsx" size={26} x={620} y={350} at={MACHINE_AT + 1.2} color={P.lead} tool={lead(1.4, 76)} align="center" speed={1000} />
    </g>
    {/* The crank, turning on its own axle. */}
    <g transform="translate(530 520)">
      <g animation={[enter({ at: MACHINE_AT + 0.9, over: 0.3 }, { scale: 0 }, ease.pop), motion({ rotate: 0 }).at(CRANK.at).to({ rotate: -720 }, CRANK.over, ease.inOut)]}>
        <circle r={26} fill={P.card} stroke={P.lead} strokeWidth={2.4} />
        <path d="M0 0L-40 -22" stroke={P.lead} strokeWidth={3.4} strokeLinecap="round" />
        <circle cx={-40} cy={-22} r={6} fill={P.red} stroke={P.lead} strokeWidth={2} />
        <circle r={4} fill={P.lead} />
      </g>
    </g>
    {[0, 1, 2, 3, 4].map((i) => {
      const t = CRANK.at + 0.2 + i * 0.36;
      return (
        <g transform={`translate(${600 + (i % 2 ? 40 : -10)} 345)`}>
          <circle r={9 + (i % 3) * 4} fill={P.card} stroke={P.blue} strokeWidth={1.8} animation={motion({ scale: 0, opacity: 1, x: 0, y: 0 }).at(t).to({ scale: 1, y: -50, x: i % 2 ? 14 : -14 }, 0.5, ease.out).to({ opacity: 0, y: -80 }, 0.4, ease.in)} />
        </g>
      );
    })}
  </g>
);

// The file that comes out. Its own little ball bounces on the clock: it is a real animated SVG now.
const MiniBall = ({ x, y, h, r, period }: { x: number; y: number; h: number; r: number; period: number }) => (
  <g transform={`translate(${x} ${y})`} class="idle">
    <path d={`M${-r * 1.4} ${r + 1}h${r * 2.8}`} stroke={P.lead} strokeWidth={1.4} opacity={0.5} />
    <g animation={motion({ y: 0 }).to({ y: -h }, period / 2, ease.out).to({ y: 0 }, period / 2, ease.in).loop(period)}>
      <circle r={r} fill={P.ball} stroke={P.lead} strokeWidth={Math.max(1.2, r / 9)} />
      <circle cx={-r * 0.3} cy={-r * 0.2} r={r * 0.13} fill={P.lead} />
      <circle cx={r * 0.3} cy={-r * 0.2} r={r * 0.13} fill={P.lead} />
    </g>
  </g>
);
const fileIcon = (
  <>
    <path d="M-55 -75H25L55 -45V75H-55Z" fill={P.card} stroke={P.lead} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M25 -75V-45H55" fill="#EFE7D4" stroke={P.lead} strokeWidth={2.2} strokeLinejoin="round" />
    <MiniBall x={0} y={10} h={46} r={13} period={1} />
    <text x={0} y={60} fontFamily={mono} fontSize={15} textAnchor="middle" fill={P.lead}>bounce.svg</text>
  </>
);
const sizeNote = write({ text: "2 KB", size: 28, x: FILE[0] - 10, y: FILE[1] + 120, at: OUT_AT + 0.5, color: P.red, tool: lead(1.8, 80), align: "center" });
const theFile = (
  <g transform={`translate(${FILE[0]} ${FILE[1]})`}>
    <g animation={[
      motion({ scale: 0, opacity: 0, x: -80, y: 20 }).at(OUT_AT).set({ opacity: 1 }).to({ scale: 1, x: 0, y: 0 }, 0.5, ease.pop),
      motion({ x: 0, y: 0, scale: 1, opacity: 1 }).at(33.2).to({ x: 500 - FILE[0], y: 470 - FILE[1], scale: 1.3 }, 0.8, ease.inOut).at(34.6).to({ scale: 0, opacity: 0 }, 0.3, ease.in),
    ]}>
      {fileIcon}
    </g>
  </g>
);
const insideHeader = write({ text: "inside bounce.svg:", size: 34, x: 80, y: 160, at: listAt - 0.6, color: P.blue, tool: lead(1.9, 81) });
const list = strikes.map((word, i) => {
  const y = 220 + i * 48;
  const w = write({ text: word, size: 34, x: 100, y, at: listAt + i * 0.9, color: P.lead, tool: lead(2, 82 + i), speed: 1300 });
  const width = hand.measure(word, 34);
  return (
    <>
      {w.node}
      <Ink d={`M92 ${y - 11}C${130 + width * 0.3} ${y - 15} ${100 + width * 0.7} ${y - 8} ${112 + width} ${y - 13}`} tool={lead(3, 90 + i)} color={P.red} draw={{ at: w.done + 0.1, over: 0.25 }} />
    </>
  );
});
const justCss = write({ text: "just CSS keyframes.", size: 38, x: 100, y: 430, at: listAt + strikes.length * 0.9 + 0.2, color: P.red, tool: lead(2.4, 95) });
const chapterCompile = (
  <>
    {machine}
    {theFile}
    <g animation={leave(33, 0.5, -16)}>
      {sizeNote.node}
      {insideHeader.node}
      {list}
      {justCss.node}
      <Ink d={circlePath(260, 418, 190, 34, -2.9, 1.06)} tool={lead(2, 96)} color={P.red} draw={{ at: justCss.done + 0.1, over: 0.4 }} />
    </g>
  </>
);

// ─── Chapter 4: everywhere an image goes. ────────────────────────────────────

const PLACES_AT = 34.6;
const PLACES_OUT = 43.6;
const place = (i: number, node: SvgNode, away: { x: number; y: number }) => (
  <g animation={[enter({ at: PLACES_AT + i * 0.25, over: 0.5 }, { scale: 0.2, opacity: 0 }, ease.pop), motion({ x: 0, y: 0, opacity: 1 }).at(PLACES_OUT + i * 0.15).to({ ...away, opacity: 0 }, 0.6, ease.in)]}>{node}</g>
);
const scribble = (x: number, y: number, w: number, seed: number, color: Color = "#BDB6A6") => <Stroke d={`M${x} ${y}C${x + w * 0.3} ${y - 3} ${x + w * 0.6} ${y + 3} ${x + w} ${y}`} tool={lead(3, seed)} color={color} />;
const readme = (
  <>
    <rect x={70} y={150} width={400} height={330} rx={10} fill={P.card} stroke={P.lead} strokeWidth={2.4} />
    <path d="M70 196H470" stroke={P.lead} strokeWidth={1.6} />
    <text x={92} y={180} fontFamily={mono} fontSize={16} fill={P.lead}>README.md</text>
    {scribble(96, 228, 160, 100, P.lead)}
    {scribble(96, 254, 300, 101)}
    <rect x={110} y={274} width={320} height={150} rx={6} fill="#F4EFE3" />
    <MiniBall x={270} y={398} h={86} r={18} period={1} />
    {scribble(96, 452, 260, 102)}
  </>
);
const slide = (
  <>
    <rect x={540} y={160} width={390} height={230} rx={6} fill={P.card} stroke={P.lead} strokeWidth={2.4} />
    <path d="M735 390V430M700 430H770" stroke={P.lead} strokeWidth={2.4} strokeLinecap="round" />
    {scribble(570, 200, 170, 103, P.lead)}
    {scribble(570, 226, 110, 104)}
    <MiniBall x={830} y={350} h={110} r={20} period={1.2} />
    <text x={910} y={376} fontFamily={mono} fontSize={13} textAnchor="end" fill={P.lead} opacity={0.6}>3/12</text>
  </>
);
const chat = (
  <>
    <path d="M300 540H700Q720 540 720 560V760Q720 780 700 780H360L320 812L328 780H300Q280 780 280 760V560Q280 540 300 540Z" fill={P.card} stroke={P.lead} strokeWidth={2.4} strokeLinejoin="round" />
    <Written text="look what i made!!" size={28} x={306} y={584} at={PLACES_AT + 0.9} color={P.lead} tool={lead(1.7, 105)} />
    <rect x={306} y={604} width={388} height={150} rx={8} fill="#F4EFE3" />
    <MiniBall x={500} y={730} h={90} r={17} period={0.8} />
  </>
);
const anywhere = write({ text: "it's an <img>. it plays anywhere.", size: 38, x: S / 2, y: 868, at: 36.2, color: P.blue, tool: lead(2.2, 110), align: "center" });
const stopNote = write({ text: "these run on their own. stop scrolling!", size: 26, x: S / 2, y: 120, at: 38.4, color: P.red, tool: lead(1.6, 111), align: "center" });
const chapterPlaces = (
  <>
    {place(0, readme, { x: -500, y: -40 })}
    {place(1, slide, { x: 500, y: -60 })}
    {place(2, chat, { x: 0, y: 500 })}
    <g animation={leave(PLACES_OUT, 0.5)}>
      {anywhere.node}
      {stopNote.node}
    </g>
  </>
);

// ─── Chapter 5: your turn. ───────────────────────────────────────────────────

const sparkle = (x: number, y: number, t: number, r: number) => (
  <g transform={`translate(${x} ${y})`}>
    <path d={`M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`} fill={P.marker} stroke={P.lead} strokeWidth={1.8} strokeLinejoin="round" animation={enter({ at: t, over: 0.3 }, { scale: 0, rotate: -90 }, ease.pop)} />
  </g>
);
const yourTurn = write({ text: "your turn.", size: 130, x: S / 2, y: 330, at: 47.6, color: P.lead, tool: nib({ size: 9, angle: 32, thin: 0.25 }), speed: 1300, align: "center" });
const rewind = write({ text: "scroll back up to rewind", size: 28, x: S / 2, y: 868, at: 52.6, color: P.red, tool: lead(1.7, 120), align: "center" });
const chapterYou = (
  <>
    {sparkle(400, 520, 46.3, 16)}
    {sparkle(610, 500, 46.45, 22)}
    {sparkle(630, 640, 46.6, 12)}
    {sparkle(372, 640, 46.75, 10)}
    {yourTurn.node}
    <Ink d="M330 352C420 344 560 350 680 340" tool={lead(3, 121)} color={P.red} draw={{ at: yourTurn.done, over: 0.4 }} />
    <g class="scrollonly">{rewind.node}</g>
  </>
);

// ─── The sheet: peg holes, printed marks and the exposure ruler. ─────────────

const RULER = { x0: 70, x1: 930, y: 930 };
const rx = (t: number) => lerp(RULER.x0, RULER.x1, t / D);
const CHAPTERS = [
  { t: 3.4, name: "keys" },
  { t: 11.4, name: "code" },
  { t: 22.6, name: "make" },
  { t: 34.6, name: "anywhere" },
  { t: 45, name: "you" },
];
const sheet = (
  <>
    <rect width={S} height={S} fill={P.paper} />
    {/* Peg holes: a round one between two slots, as on Acme-punched animation paper. */}
    <rect x={330} y={22} width={90} height={22} rx={11} fill="#2A2533" />
    <circle cx={500} cy={33} r={12} fill="#2A2533" />
    <rect x={580} y={22} width={90} height={22} rx={11} fill="#2A2533" />
    <g fontFamily={mono} fontSize={12} fill={P.blue} opacity={0.7}>
      <text x={40} y={40}>SVJEEZ · PENCIL TEST</text>
      <text x={712} y={40}>SC 01</text>
      <text x={790} y={40}>FR</text>
      <path d="M812 44H960" stroke={P.blue} strokeWidth={1} />
    </g>
    {/* Field corners. */}
    <path d="M40 80V60H60M960 80V60H940M40 870V890H60M960 870V890H940" fill="none" stroke={P.ghost} strokeWidth={1.4} />
    <g opacity={0.9}>
      <path d={`M${RULER.x0} ${RULER.y}H${RULER.x1}`} stroke={P.blue} strokeWidth={1.4} />
      {Array.from({ length: D + 1 }, (_, i) => (
        <path d={`M${rx(i)} ${RULER.y}v${i % 10 ? 7 : 14}`} stroke={P.blue} strokeWidth={i % 10 ? 1 : 1.4} opacity={i % 10 ? 0.6 : 1} />
      ))}
      {CHAPTERS.map((c) => (
        <>
          <path d={`M${rx(c.t)} ${RULER.y}v-12`} stroke={P.red} strokeWidth={1.6} />
          <Written text={c.name} size={19} x={rx(c.t) + 5} y={RULER.y - 8} at={-1} color={P.lead} tool={lead(1.1, 130)} />
        </>
      ))}
      <g transform={`translate(${RULER.x0} ${RULER.y})`}>
        <g animation={motion({ x: 0 }).to({ x: RULER.x1 - RULER.x0 }, D, ease.linear)}>
          <path d="M0 -22V24" stroke={P.red} strokeWidth={2} />
          <path d="M-8 -30H8L0 -20Z" fill={P.red} />
        </g>
      </g>
    </g>
  </>
);

export default function build(): string {
  return render(
    {
      width: S,
      height: S,
      duration: D,
      loop: false,
      title: "svjeez",
      desc: "A pencil test on a sheet of animation paper. svjeez is written in ink with the line 'draw in TSX, get one animated SVG'. A sleeping orange ball wakes up and bounces across the page, leaving blue onion-skin ghosts, numbered keys and a dotted arc. An index card types out the TSX for the bounce while the ball bounces beside it, the lines highlighted as they run. The card is cranked through a little machine, which drops out bounce.svg; a list of what is not inside it, javascript, a runtime, a video file and dependencies, is struck out in red for 'just CSS keyframes.' The file lands in a README, a slide and a chat message, bouncing in each. Finally the ball grows, bows among sparkles, and 'your turn.' is written above it.",
      reducedMotion: { at: D - 0.5 },
      css: ".pre{white-space:pre}",
      comment: "Generated by svjeez. Edit examples/landing/index.tsx instead of this file.",
    },
    <>
      {sheet}
      {titleNode}
      {scrollHint}
      {ground}
      {chapterKeys}
      {chapterCode}
      {chapterCompile}
      {chapterPlaces}
      {chapterYou}
      {zzz}
      {bang}
      {ball}
    </>,
  );
}
