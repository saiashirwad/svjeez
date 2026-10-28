import { Glyphs, draw, ease, enter, font, motion, render } from "svjeez";
import { CSS, chrome, outro, theme } from "./kit";

// Two real fonts embedded in one file. Each is cut down to the glyphs this card uses.
const W = 504;
const H = 340;
const BAR = 40;
const D = 9;
const load = (file: string) => font.load(new URL(`../fonts/${file}`, import.meta.url));
const display = await load("ArchivoBlack-Regular.ttf");
const italic = await load("ABeeZee-Italic.ttf");

const win = chrome(W, H, "fonts.tsx");
const TITLE = "Aa Type";
const size = 76;
const left = 36;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Your fonts, embedded",
      desc: "The words Aa Type draw on as outlines in an embedded display font and fill in. Below, real text in an embedded italic and a monospaced font.",
      css: CSS,
      reducedMotion: { at: D - 2 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <Glyphs font={display} text={TITLE} size={size} x={left} y={BAR + 112} fill="none" stroke={theme.base0D} strokeWidth={1.5} animation={(_, i) => draw({ at: 0.3 + i * 0.12, over: 0.9 }, ease.inOut)} />
        <Glyphs font={display} text={TITLE} size={size} x={left} y={BAR + 112} fill={theme.base06} alt="" animation={(_, i) => enter({ at: 1.3 + i * 0.08, over: 0.5 }, { opacity: 0, y: 10 })} />
        <g animation={enter({ at: 2.4, over: 0.6 }, { y: 8 })}>
          <text x={left} y={BAR + 168} fontFamily={italic} fontSize={26} fill={theme.base05}>Real text, measured to the pixel.</text>
        </g>
        <g animation={enter({ at: 3.2, over: 0.6 }, { y: 8 })}>
          <rect x={left} y={BAR + 196} width={W - 2 * left} height={64} rx={10} fill={theme.base01} />
          <text class="mono" x={left + 18} y={BAR + 224} fontSize={13} fill={theme.base04}>await font.load(new URL("./Archivo.ttf"))</text>
          <text class="mono" x={left + 18} y={BAR + 246} fontSize={13} fill={theme.base0B}>{"<text fontFamily={display}>"}</text>
        </g>
        <g animation={enter({ at: 4, over: 0.6 })} class="sans">
          <text x={left} y={H - 24} fontSize={12} fill={theme.base03}>Subset to the glyphs it draws. One file, no font requests.</text>
        </g>
      </g>
    </>,
  );
}
