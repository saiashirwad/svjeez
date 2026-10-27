import { draw, ease, motion, rect, render, type Color } from "svg-motion";
import { Arrow, Brace, Focus, Marker, Underline, code, morph, timeline, type Tokens } from "svjeez/explain";

const W = 1200;
const H = 550;

const C = {
  bg: "#0a0b0e",
  window: "#111318",
  edge: "#ffffff12",
  bar: "#ffffff08",
  text: "#d7dae0",
  punct: "#626a7c",
  keyword: "#8c95a8",
  fn: "#ffc799",
  string: "#99ffe4",
  tag: "#a8b8ff",
  gutter: "#3a404d",
  head: "#f1f2f5",
  body: "#8d95a6",
  accent: "#ffc799",
} as const satisfies Record<string, Color>;

const tl = timeline({ setup: 4.5, problem: 5, refactor: 5, result: 6, rewind: 1.4 }, { gap: 0.6 });
const slides = ["setup", "problem", "refactor", "result"] as const;

const KEYWORDS = new Set(["function", "const", "return"]);
const tokenize = (source: string): Tokens =>
  source.split("\n").map((line) => {
    const parts = line.match(/\s+|"[^"]*"|[A-Za-z_$][\w$]*|\d+|=>|===|[^\w\s]/g) ?? [];
    return parts.map((content, i) => {
      const next = parts.slice(i + 1).find((p) => p.trim());
      const prev = parts.slice(0, i).findLast((p) => p.trim());
      const color: Color = /^\s+$/.test(content)
        ? C.text
        : KEYWORDS.has(content)
          ? C.keyword
          : /^"/.test(content) || /^\d/.test(content)
            ? C.string
            : /^[A-Za-z_$]/.test(content) && (next === "(" || /^[A-Z]/.test(content))
              ? C.fn
              : /^[A-Za-z_$]/.test(content) && (prev === "<" || prev === "/")
                ? C.tag
                : /^[A-Za-z_$]/.test(content)
                  ? C.text
                  : C.punct;
      return { content, color };
    });
  });

const before = `function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}`;

const after = `function Counter() {
  const [count, dispatch] = useReducer(reducer, 0);

  return (
    <button onClick={() => dispatch("inc")}>
      {count}
    </button>
  );
}

function reducer(count, action) {
  return action === "inc" ? count + 1 : count;
}`;

const frame = { x: 40, y: 40, w: 700, h: 470 };
const settings = { x: 104, y: 112, fontSize: 16, lineHeight: 1.75 };
const one = code(tokenize(before), settings);
const two = code(tokenize(after), settings);
const m = morph([one, two, one], { at: [tl.refactor, tl.rewind], over: 0.9, gutter: true });

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
        <path d={`M${panel.x + i * (seg + gap)} ${y}h${seg}`} stroke="#ffffff14" strokeWidth={2} strokeLinecap="round" />
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
  const rule = one.find("setCount(count + 1)");
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

      <g>
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={14} fill={C.window} stroke={C.edge} />
        <path d={`M${frame.x} ${frame.y + 44}h${frame.w}`} stroke={C.edge} />
        {[0, 1, 2].map((i) => (
          <circle cx={frame.x + 22 + i * 18} cy={frame.y + 22} r={5.5} fill="#ffffff1c" />
        ))}
        <text x={frame.x + frame.w / 2} y={frame.y + 26.5} class="mono" fontSize={12} textAnchor="middle" fill={C.body}>
          Counter.tsx
        </text>
      </g>

      <Focus stops={[{ during: tl.problem, on: rect(frame.x, one.lines(5).y, frame.w, one.lines(5).h) }]} dim={0.28}>
        <Marker
          color={C.accent}
          stops={[
            { at: tl.setup, rect: one.lines(2).pad(5) },
            { at: tl.problem, rect: rule.pad(4) },
            { at: tl.refactor, rect: two.find("useReducer(reducer, 0)").pad(4) },
            { at: tl.result, rect: two.find('dispatch("inc")').pad(4) },
            { at: tl.rewind, rect: one.lines(2).pad(5) },
          ]}
        />
        <g class="code">{m.node}</g>
      </Focus>

      <g class="note">
        <Underline rect={one.find("count", 1)} during={{ at: tl.setup.at + 0.8, over: tl.setup.over - 0.8 }} color={C.accent} />
        <Underline rect={one.find("setCount", 1)} during={{ at: tl.setup.at + 1.4, over: tl.setup.over - 1.4 }} color={C.accent} />
        <Arrow from={rule.pad(4).bottom} to={{ x: panel.x - 16, y: 317 }} bend={0.22} during={tl.problem} color={C.accent} />
        <Underline rect={two.find("useReducer")} during={tl.refactor} color={C.accent} />
        <Brace lines={two.lines(11, 13)} side="right" label="the rule" during={tl.result} color={C.accent} />
        <Arrow from={two.find('dispatch("inc")').bottom} to={two.find("reducer", 2).top} bend={0.35} during={tl.result} color={C.accent} />
      </g>

      <text x={panel.x} y={98} class="mono" fontSize={11} letterSpacing={2.2} fill={C.gutter}>
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
