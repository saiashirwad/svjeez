import { draw, ease, motion, rect, render } from "svjeez";
import { Arrow, Brace, Focus, Marker, Underline, base16, code, morph, timeline, tint, appWindow, type CodeRun, type CodeTokens } from "svjeez/extras";

const W = 1200;
const H = 550;

const theme = base16(
  "#111318", "#1a1d24", "#23262e", "#3a404d", "#626a7c", "#d7dae0", "#f1f2f5", "#ffffff",
  "#a8b8ff", "#99ffe4", "#ffc799", "#99ffe4", "#99ffe4", "#ffc799", "#8c95a8", "#ffc799",
);
const C = { bg: "#0a0b0e", head: theme.base06, body: "#8d95a6", accent: tint(theme, "fn"), dim: theme.base03 } as const;

const tl = timeline({ setup: 4.5, problem: 5, refactor: 5, result: 6, rewind: 1.4 }, { gap: 0.6 });
const slides = ["setup", "problem", "refactor", "result"] as const;

const kw = (text: string): CodeRun => ["keyword", text];
const fn = (text: string, id?: string): CodeRun => ["fn", text, id];
const p = (text: string, id?: string): CodeRun => ["punct", text, id];
const str = (text: string): CodeRun => ["string", text];
const num = (text: string, id?: string): CodeRun => ["number", text, id];
const tag = (text: string): CodeRun => ["tag", text];

const before: CodeTokens = [
  [kw("function"), " ", fn("Counter"), p("() {")],
  ["  ", kw("const"), " ", p("["), "count", p(","), " ", ["plain", "setCount", "setter"], p("]"), " ", p("="), " ", fn("useState", "hook"), p("("), num("0"), p(");")],
  [],
  ["  ", kw("return"), " ", p("(")],
  ["    ", p("<"), tag("button"), " onClick", p("={() =>"), " ", fn("setCount", "rule"), p("(", "rule"), ["plain", "count", "rule"], " ", p("+", "rule"), " ", num("1", "rule"), p(")", "rule"), p("}>")],
  ["      ", p("{"), "count", p("}")],
  ["    ", p("</"), tag("button"), p(">")],
  ["  ", p(");")],
  [p("}")],
];

const after: CodeTokens = [
  [kw("function"), " ", fn("Counter"), p("() {")],
  ["  ", kw("const"), " ", p("["), "count", p(","), " ", ["plain", "dispatch", "setter"], p("]"), " ", p("="), " ", fn("useReducer", "hook"), p("("), "reducer", p(","), " ", num("0"), p(");")],
  [],
  ["  ", kw("return"), " ", p("(")],
  ["    ", p("<"), tag("button"), " onClick", p("={() =>"), " ", fn("dispatch", "send"), p("(", "send"), str('"inc"'), p(")", "send"), p("}>")],
  ["      ", p("{"), "count", p("}")],
  ["    ", p("</"), tag("button"), p(">")],
  ["  ", p(");")],
  [p("}")],
  [],
  [kw("function"), " ", fn("reducer", "def"), p("("), "count", p(","), " action", p(")"), " ", p("{")],
  ["  ", kw("return"), " action ", p("==="), " ", str('"inc"'), " ", p("?"), " count ", p("+"), " ", num("1"), " ", p(":"), " count", p(";")],
  [p("}")],
];

const frame = rect(40, 40, 700, 470);
const editor = appWindow(frame, { theme, title: "Counter.tsx", class: "mono" });
const settings = { x: 104, y: editor.body.y + 28, fontSize: 16, lineHeight: 1.75, theme };
const one = code(before, settings);
const two = code(after, settings);
const m = morph([one, two, one], { at: [tl.refactor.at, tl.rewind.at], over: 0.9, gutter: true });

const panel = { x: 792, w: 360 };
const copy: Record<(typeof slides)[number], { kicker: string; head: string[]; body: string[] }> = {
  setup: {
    kicker: "01  THE SETUP",
    head: ["One piece of state"],
    body: ["useState hands the counter a value", "and a setter to change it."],
  },
  problem: {
    kicker: "02  THE PROBLEM",
    head: ["The rule hides", "in a handler"],
    body: ["How count changes is written inline.", "Every new button has to repeat it."],
  },
  refactor: {
    kicker: "03  THE MOVE",
    head: ["Lift the rule", "into a reducer"],
    body: ["useReducer takes a pure function", "that owns every state change."],
  },
  result: {
    kicker: "04  THE RESULT",
    head: ["Handlers send intent"],
    body: ["The button dispatches \"inc\".", "The reducer decides what it means,", "in one place."],
  },
};

const slide = (name: (typeof slides)[number]) => {
  const { at, over } = tl[name];
  const fade = 0.45;
  const { kicker, head, body } = copy[name];
  const headTop = 228;
  const bodyTop = headTop + head.length * 36 + 22;
  return (
    <g animation={motion({ opacity: 0, y: 10 }).at(at).to({ opacity: 1, y: 0 }, fade).at(at + over - 0.3).to({ opacity: 0, y: -6 }, 0.3, ease.in)}>
      <text x={panel.x} y={190} class="mono" fontSize={11} letterSpacing={2.2} fill={C.accent}>
        {kicker}
      </text>
      {head.map((line, i) => (
        <text x={panel.x} y={headTop + i * 36} class="sans" fontSize={29} fontWeight={600} letterSpacing={-0.6} fill={C.head}>
          {line}
        </text>
      ))}
      {body.map((line, i) => (
        <text x={panel.x} y={bodyTop + i * 24} class="sans" fontSize={15.5} fill={C.body}>
          {line}
        </text>
      ))}
    </g>
  );
};

const progress = () => {
  const gap = 10;
  const seg = (panel.w - gap * (slides.length - 1)) / slides.length;
  const y = frame.y + frame.h;
  return (
    <g>
      {slides.map((_, i) => (
        <path d={`M${panel.x + i * (seg + gap)} ${y}h${seg}`} stroke={theme.base02} strokeWidth={2} strokeLinecap="round" />
      ))}
      <g animation={motion({ opacity: 1 }).at(tl.rewind.at).to({ opacity: 0 }, 0.5)}>
        {slides.map((name, i) => (
          <path
            d={`M${panel.x + i * (seg + gap)} ${y}h${seg}`}
            fill="none"
            stroke={C.accent}
            strokeWidth={2}
            strokeLinecap="round"
            animation={draw({ at: tl[name].at, over: tl[name].over + (i < slides.length - 1 ? 0.6 : 0) }, ease.linear)}
          />
        ))}
      </g>
    </g>
  );
};

export default function build(): string {
  const rule = one.get("rule");
  return render(
    {
      width: W,
      height: H,
      title: "From state to reducer",
      desc: "A React counter moves its update rule out of a click handler and into a reducer.",
      duration: tl.duration,
      reducedMotion: { at: tl.result.at + 2 },
      css: [
        ".mono,.code text{font-family:'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none}",
        ".sans,.note text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}",
      ].join("\n"),
    },
    <>
      <rect width={W} height={H} fill={C.bg} />

      {editor.node}

      <Focus stops={[{ during: tl.problem, target: rect(frame.x, one.lines(5).y, frame.w, one.lines(5).h) }]} dim={0.28}>
        <Marker
          color={C.accent}
          stops={[
            { during: tl.setup, target: one.lines(2).pad(5) },
            { during: tl.problem, target: rule.pad(4) },
            { during: tl.refactor, target: two.find("useReducer(reducer, 0)").pad(4) },
            { during: tl.result, target: two.get("send").pad(4) },
            { during: tl.rewind, target: one.lines(2).pad(5) },
          ]}
        />
        <g class="code">{m.node}</g>
      </Focus>

      <g class="note">
        <Underline target={one.find("count", 1)} during={{ at: tl.setup.at + 0.8, over: tl.setup.over - 0.8 }} color={C.accent} />
        <Underline target={one.find("setCount", 1)} during={{ at: tl.setup.at + 1.4, over: tl.setup.over - 1.4 }} color={C.accent} />
        <Arrow from={rule.pad(4).bottom} to={{ x: panel.x - 16, y: 317 }} bend={0.22} during={tl.problem} color={C.accent} />
        <Underline target={two.find("useReducer")} during={tl.refactor} color={C.accent} />
        <Brace target={two.lines(11, 13)} side="right" label="the rule" during={tl.result} color={C.accent} />
        <Arrow from={two.get("send").bottom} to={two.get("def").top} bend={0.35} during={tl.result} color={C.accent} />
      </g>

      <text x={panel.x} y={98} class="mono" fontSize={11} letterSpacing={2.2} fill={C.dim}>
        REACT · REFACTOR
      </text>
      <text x={panel.x} y={124} class="sans" fontSize={15} fill={C.body}>
        useState → useReducer
      </text>
      {slides.map(slide)}
      {progress()}
    </>,
  );
}
