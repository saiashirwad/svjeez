import {
  def,
  draw,
  ease,
  enter,
  motion,
  rect,
  render,
  sampled,
  strokeFont,
  type Motion,
} from "svjeez";
import { Marker, code, typewriter, appWindow, type CodeRun, type CodeTokens } from "svjeez/extras";
import { css, mono, theme } from "../style";
import { SCHEME_CSS } from "./kit";

// The landing hero: a few lines of TSX type out on the left, and the picture they describe draws itself on the right.
// `layout` picks the same scene's wide cut for laptops or a stacked cut for phones.
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

const tag = (text: string): CodeRun => ["tag", text];
const p = (text: string): CodeRun => ["punct", text];
const fn = (text: string): CodeRun => ["fn", text];
const n = (text: string): CodeRun => ["number", text];

const source: CodeTokens = [
  [fn("render"), p("({ width: "), n("540"), p(", height: "), n("320"), p(" }, <>")],
  [
    "  ",
    tag("<path"),
    " d",
    p("={hill} "),
    "animation",
    p("={"),
    fn("draw"),
    p("({ at: "),
    n("1"),
    p(" })} />"),
  ],
  ["  ", tag("<circle"), " r", p("={"), n("34"), p("} "), "fill", p("={sun}")],
  [
    "    animation",
    p("={"),
    fn("motion"),
    p("({ y: "),
    n("150"),
    p(" }).to({ y: "),
    n("0"),
    p(" })} />"),
  ],
  ["  ", tag("<Ink"), " d", p("={hello} "), "draw", p("={{ at: "), n("4"), p(" }} />")],
  ["  ", tag("<path"), " d", p("={bird} "), "animation", p("={"), fn("sampled"), p("(fly)} />")],
  [p("</>)")],
  [],
  [["comment", "// $ npx svjeez svg hello.tsx"]],
];

const SCENE = { w: 540, h: 320 };
const D = 15;
const CPS = 42;
const START = 0.6;

const LAYOUTS = {
  wide: {
    W: 1200,
    H: 420,
    font: 16,
    editor: rect(30, 30, 540, 360),
    canvas: rect(630, 30, 540, 360),
    scale: 1,
    arrow: "M580 210H620",
  },
  tall: {
    W: 520,
    H: 707,
    font: 14,
    editor: rect(20, 16, 480, 300),
    canvas: rect(20, 366, 480, 325),
    scale: 0.889,
    arrow: "M260 324V358",
  },
} as const;

export function make(layout: keyof typeof LAYOUTS): string {
  const L = LAYOUTS[layout];
  const editor = appWindow(L.editor, { theme, title: "hello.tsx" });
  const canvas = appWindow(L.canvas, { theme, title: "hello.svg" });

  const src = code(source, {
    theme,
    font: mono,
    fontSize: L.font,
    lineHeight: 1.85,
    x: editor.body.x + 22,
    y: editor.body.y + 20,
  });

  const typed = typewriter(src, { at: START, cps: CPS, cursor: theme.base09, blink: false });
  const done = typed.spans.map((span) => span.at + span.over + 0.1);
  const [hillAt, sunAt, handAt, birdAt] = [done[1]!, done[3]!, done[4]!, done[5]!];

  const stops = [
    { during: { at: hillAt, over: 1.2 }, target: src.lines(2).pad(3) },
    { during: { at: sunAt, over: 2 }, target: src.lines(3, 4).pad(3) },
    { during: { at: handAt, over: 2 }, target: src.lines(5).pad(3) },
    { during: { at: birdAt, over: 3 }, target: src.lines(6).pad(3) },
  ];

  const hill = "M0 262C90 214 190 222 270 252C340 278 430 276 540 222V320H0Z";
  const hillLine = "M0 262C90 214 190 222 270 252C340 278 430 276 540 222";
  const words = hand.path("hello,", { size: 104, x: 40, y: 120 }).d.split(/(?=M)/);

  const lengthOf = (d: string) => {
    const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    let sum = 0;

    for (let i = 2; i + 1 < xy.length; i += 2)
      sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

    return sum;
  };

  const strokes: { d: string; at: number; over: number }[] = [];

  for (const d of words) {
    const last = strokes.at(-1);
    const at = last ? last.at + last.over + 0.04 : handAt;

    strokes.push({ d, at, over: Math.max(0.08, lengthOf(d) / 520) });
  }

  const fly = sampled(
    (t) => {
      const u = Math.min(1, Math.max(0, (t - birdAt) / 5));

      return {
        x: -30 + 600 * u,
        y: 150 - 60 * Math.sin(Math.PI * u) - 20 * u,
        rotate: -8 * Math.cos(Math.PI * u),
      };
    },
    { duration: D, tolerance: { translate: 1, rotate: 1 } },
  );

  const flap = Array.from({ length: 11 }).reduce<Motion<"scale">>(
    (m) => m.to({ scale: 0.55 }, 0.22, ease.inOut).to({ scale: 1 }, 0.22, ease.inOut),
    motion({ scale: 1 }).at(birdAt),
  );

  const rays = Array.from({ length: 10 }, (_, i) => (
    <path
      d="M0-46V-58"
      stroke={theme.base0A}
      strokeWidth={4}
      strokeLinecap="round"
      transform={`rotate(${i * 36})`}
    />
  ));

  const rise = [
    enter({ at: sunAt - 0.1, over: 0.2 }),
    motion({ y: 150 }).at(sunAt).to({ y: 0 }, 2.2, ease.out),
  ];

  const clip = def.clipPath({}, <rect width={SCENE.w} height={SCENE.h} />);

  return render(
    {
      width: L.W,
      height: L.H,
      duration: D,
      title: "svjeez: TSX in, one SVG out",
      desc: "A few lines of TSX type out in an editor. As each line lands, the picture it describes draws itself in a canvas beside it: a hill is inked, a sun rises, the word hello is handwritten and a bird flies across. The colors follow the viewer's light or dark scheme.",
      css: [css, SCHEME_CSS].join("\n"),
      reducedMotion: { at: D - 1.5 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g fontFamily={mono}>
        {editor.node}
        {canvas.node}
      </g>
      <path
        d={L.arrow}
        stroke={theme.base03}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 7"
        fill="none"
        animation={enter({ at: START, over: 0.5 })}
      />
      <g
        animation={motion({ opacity: 1 })
          .at(D - 0.7)
          .to({ opacity: 0 }, 0.6)}
      >
        <g animation={enter({ at: hillAt - 0.2, over: 0.3 })}>
          <Marker stops={stops} color={theme.base09} />
        </g>
        {typed.node}
        <g transform={`translate(${L.canvas.x} ${L.canvas.y + 40}) scale(${L.scale})`}>
          <rect width={SCENE.w} height={SCENE.h} fill={theme.base01} />
          <g clipPath={clip}>
            <g animation={enter({ at: START, over: 0.6 })}>
              <g transform="translate(360 150)">
                <g class="day" animation={rise}>
                  <circle r={34} fill={theme.base0A} />
                  <g animation={motion({ rotate: 0 }).at(sunAt).to({ rotate: 90 }, 2.4, ease.out)}>
                    {rays}
                  </g>
                </g>
                <g class="night" animation={rise}>
                  <circle r={34} fill={theme.base0A} />
                  <circle cx={15} cy={-10} r={30} fill={theme.base01} />
                </g>
              </g>
              <path d={hill} fill={theme.base01} />
              <path
                d={hillLine}
                fill="none"
                stroke={theme.base06}
                strokeWidth={3}
                strokeLinecap="round"
                animation={draw({ at: hillAt, over: 1.2 })}
              />
            </g>
            {strokes.map((s) => (
              <path
                d={s.d}
                fill="none"
                stroke={theme.base08}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                animation={draw({ at: s.at, over: s.over }, ease.linear)}
              />
            ))}
            <g animation={[enter({ at: birdAt, over: 0.2 }), fly]}>
              <path
                d="M-12 0Q-6-9 0 0Q6-9 12 0"
                fill="none"
                stroke={theme.base06}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                animation={flap}
              />
            </g>
          </g>
        </g>
      </g>
    </>,
  );
}
