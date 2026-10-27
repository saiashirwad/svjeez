import { Glyphs, draw, ease, enter, font, motion, render } from "svjeez";

const W = 680;
const H = 360;
const D = 6;

const load = (file: string) => font.load(new URL(`./${file}`, import.meta.url));
const display = await load("ArchivoBlack-Regular.ttf");
const body = font.family(await load("ABeeZee-Regular.ttf"), await load("ABeeZee-Italic.ttf"));

const C = { bg: "#12101C", ink: "#F4EFFF", accent: "#FF5FA8", soft: "#A99CD6", rule: "#3EE6D6" } as const;

const TITLE = "Wave!";
const TITLE_SIZE = 120;
const titleX = (W - display.measure(TITLE, TITLE_SIZE)) / 2;

const LINE = "Real text in an embedded font,";
const ITALIC = "measured to the pixel.";
const LINE_SIZE = 30;
const regular = body.face(400);
const lineWidth = regular.measure(LINE, LINE_SIZE);
const italicWidth = body.face(400, "italic").measure(ITALIC, LINE_SIZE);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Custom fonts",
      desc: "The word Wave! draws on letter by letter as outlines, then fills. Below it, two lines of real text in an embedded font, centered by measuring them, with a rule that grows to the measured width.",
    },
    <>
      <rect width={W} height={H} fill={C.bg} />
      <Glyphs font={display} text={TITLE} size={TITLE_SIZE} x={titleX} y={160} fill="none" stroke={C.accent} strokeWidth={2} animation={(_, i) => draw({ at: 0.2 + i * 0.18, over: 1.1 }, ease.inOut)} />
      <Glyphs font={display} text={TITLE} size={TITLE_SIZE} x={titleX} y={160} fill={C.ink} alt="" animation={(_, i) => enter({ at: 1.4 + i * 0.12, over: 0.5 }, { opacity: 0, y: 12 }, ease.out)} />
      <g animation={enter({ at: 2.4, over: 0.6 }, { opacity: 0, y: 8 })}>
        <text x={(W - lineWidth) / 2} y={240} fontFamily={body} fontSize={LINE_SIZE} fill={C.ink}>
          {LINE}
        </text>
        <text x={(W - italicWidth) / 2} y={282} fontFamily={body} fontStyle="italic" fontSize={LINE_SIZE} fill={C.soft}>
          {ITALIC}
        </text>
      </g>
      <rect x={(W - lineWidth) / 2} y={300} width={lineWidth} height={3} rx={1.5} fill={C.rule} animation={motion({ scale: 0 }).at(3).to({ scale: 1 }, 0.8, ease.out)} />
    </>,
  );
}
