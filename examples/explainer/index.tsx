import {
  draw,
  ease,
  motion,
  rect,
  render,
  Arrow,
  Brace,
  Focus,
  Marker,
  Underline,
  code,
  morph,
  timeline,
  appWindow,
  type CodePiece,
  type CodeRun,
  type CodeTokens,
} from "svjeez";

import { color, geist, HEIGHT, MARGIN, mono, css, size, stroke, theme, WIDTH } from "../gallery-style";

const tl = timeline({ write: 3.5, timing: 4, css: 5, result: 4.5, rewind: 1.2 }, { gap: 0.4 });
const slides = ["write", "timing", "css", "result"] as const;

const kw = (text: string): CodeRun => ["keyword", text];
const fn = (text: string, id?: string): CodeRun => ["fn", text, id];
const p = (text: string, id?: string): CodeRun => ["punct", text, id];
const str = (text: string): CodeRun => ["string", text];
const num = (text: string, id?: string): CodeRun => ["number", text, id];
const tag = (text: string): CodeRun => ["tag", text];
const v = (text: string, id?: string): CodeRun => ["plain", text, id];
const note = (text: string): CodeRun => ["comment", text];

// The scene, exactly as the CSS beside it was rendered from it. examples/tests checks that the two agree.
const scene: CodeTokens = [
  [kw("import"), p(" { "), v("enter"), p(", "), v("render"), p(" } "), kw("from"), " ", str('"svjeez"'), p(";")],
  [],
  [kw("const"), " svg ", p("= "), fn("render"), p("(")],
  ["  ", p("{ "), "width", p(": "), num("320"), p(", "), "height", p(": "), num("180"), p(", "), "duration", p(": "), num("2"), p(" },")],
  ["  ", p("<"), tag("rect")],
  ["    x", p("={"), num("120"), p("} "), "y", p("={"), num("50"), p("} "), "width", p("={"), num("80"), p("} "), "height", p("={"), num("80"), p("} "), "rx", p("={"), num("12"), p("}")],
  [
    "    animation",
    p("={"),
    fn("enter"),
    p("("),
    p("{ ", "timing"),
    v("at", "timing"),
    p(": ", "timing"),
    num("0.5", "timing"),
    p(", ", "timing"),
    v("over", "timing"),
    p(": ", "timing"),
    num("1", "timing"),
    p(" }", "timing"),
    p(", { "),
    "x",
    p(": "),
    num("-120"),
    p(" })}"),
  ],
  ["  ", p("/>,")],
  [p(");")],
];

// What render() writes for it: the keyframes and the rule that plays them, with the whitespace added.
const keyframes: CodeTokens = [
  [fn(".a"), p(" {")],
  ["  animation-duration", p(": "), num("2s"), p(";")],
  ["  animation-iteration-count", p(": "), ["constant", "infinite"], p(";")],
  ["  animation-timing-function", p(": "), fn("cubic-bezier"), p("("), num(".23"), p(","), num("1"), p(","), num(".32"), p(","), num("1"), p(");")],
  [p("}")],
  [kw("@keyframes"), " ", fn("k1"), p(" {")],
  ["  ", num("0%"), p(", "), num("25%"), p(" { "), "translate", p(": "), num("-120px 0px"), p(" }")],
  ["  ", num("75%"), p(", "), num("100%"), p(" { "), "translate", p(": "), num("0px 0px"), p(" }")],
  [p("}")],
  [fn(".m1"), p(" { "), "animation-name", p(": "), "k1", p(" }")],
];

const page: CodeTokens = [
  [p("<"), tag("img"), " src", p("="), str('"scene.svg"'), " alt", p("="), str('"A square slides in"'), p(" />")],
  [],
  [note("<!-- scene.svg has no script in it -->")],
];

const frame = rect(MARGIN, 95, 592, 350);
const editor = appWindow(frame, { theme, title: "scene.tsx" });

const settings = {
  x: frame.x + 64,
  y: editor.body.y + 28,
  fontSize: 15,
  lineHeight: 1.75,
  theme,
  font: mono,
};

const one = code(scene, settings);
const two = code(keyframes, settings);
const three = code(page, settings);
const m = morph([one, two, three, one], {
  at: [tl.css.at, tl.result.at, tl.rewind.at],
  over: 0.9,
  gutter: true,
});

const panel = { x: frame.x + frame.w + 32, w: 240 };

const copy: Record<(typeof slides)[number], { head: string[]; body: string[] }> = {
  write: {
    head: ["A shape and", "a motion"],
    body: ["enter() slides the square", "in from 120px to the left."],
  },
  timing: {
    head: ["The timing is", "one object"],
    body: ["Start at 0.5s and take 1s,", "on a clock 2s long."],
  },
  css: {
    head: ["It compiles to", "CSS keyframes"],
    body: ["0.5s of 2s is 25%.", "1.5s of 2s is 75%.", "The browser does the rest."],
  },
  result: {
    head: ["One SVG file,", "no JavaScript"],
    body: ["It plays inside an img tag.", "The browser plays it as CSS", "animations."],
  },
};

const slide = (name: (typeof slides)[number]) => {
  const { at, over } = tl[name];
  const { head, body } = copy[name];
  const headTop = frame.y + 110;
  const bodyTop = headTop + head.length * 32 + 12;

  return (
    <g
      fontFamily={geist}
      animation={motion({ opacity: 0, y: 8 })
        .at(at)
        .to({ opacity: 1, y: 0 }, 0.45)
        .at(at + over - 0.3)
        .to({ opacity: 0, y: -6 }, 0.3, ease.in)}
    >
      {head.map((line, i) => (
        <text x={panel.x} y={headTop + i * 32} fontSize={26} fontWeight={600} fill={color.ink}>
          {line}
        </text>
      ))}
      {body.map((line, i) => (
        <text x={panel.x} y={bodyTop + i * 22} fontSize={size.subtitle} fill={color.dim}>
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
        <path
          d={`M${panel.x + i * (seg + gap)} ${y}h${seg}`}
          stroke={color.edge}
          strokeWidth={stroke.accent}
          strokeLinecap="round"
        />
      ))}
      <g animation={motion({ opacity: 1 }).at(tl.rewind.at).to({ opacity: 0 }, 0.5)}>
        {slides.map((name, i) => (
          <path
            d={`M${panel.x + i * (seg + gap)} ${y}h${seg}`}
            fill="none"
            stroke={color.accent}
            strokeWidth={stroke.accent}
            strokeLinecap="round"
            animation={draw(
              { at: tl[name].at, over: tl[name].over + (i < slides.length - 1 ? 0.4 : 0) },
              ease.linear,
            )}
          />
        ))}
      </g>
    </g>
  );
};

export default function build(): string {
  const timing = one.get("timing");
  const body = one.lines(5, 8);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      title: "How a scene becomes an SVG",
      desc: "A short svjeez scene in TSX moves a square in with enter({ at, over }). The timing line is highlighted, then the scene turns into the CSS keyframes it compiles to, then into an img tag that plays the one self-contained SVG with no JavaScript.",
      duration: tl.duration,
      reducedMotion: { at: tl.result.at + 2 },
      css,
    },
    <>
      <rect width={WIDTH} height={HEIGHT} fill={color.bg} />

      <g fontFamily={mono}>{editor.node}</g>

      <Focus
        stops={[{ show: tl.timing, target: rect(frame.x, timing.y, frame.w, timing.h) }]}
        dim={0.28}
      >
        <Marker
          color={color.accent}
          stops={[
            { show: tl.write, target: body.pad(5) },
            { show: tl.timing, target: timing.pad(4) },
            { show: tl.css, target: two.lines(7, 8).pad(5) },
            { show: tl.result, target: three.lines(1).pad(5) },
            { show: tl.rewind, target: body.pad(5) },
          ]}
        />
        {m.node}
      </Focus>

      <g fontFamily={geist}>
        <Brace
          target={two.lines(7, 8)}
          side="right"
          label="25% to 75%"
          show={tl.css}
          color={color.accent}
        />
        <Underline target={three.find('"scene.svg"')} show={tl.result} color={color.accent} />
      </g>

      {slides.map(slide)}
      {progress()}
    </>,
  );
}
