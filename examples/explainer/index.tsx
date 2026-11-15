import { highlight } from "@svjeez/code";
import { code, ease, motion, rect, render, type CodeTokens, type Rect } from "svjeez";

import { css, mono, theme } from "../style";
import scene, { hop } from "./scene.tsx";
import { chick } from "../site/lib/chick";

// You write a scene in TSX; svjeez compiles it into one SVG that animates with CSS and no JavaScript.
// The picture on the right is that scene. The left half is its source, then the CSS it compiles to, then the file.
// Each left panel crossfades as one block. examples/tests/explainer.test.tsx checks the code against scene.tsx and the CSS
// against what render() writes.

const W = 960;
const H = 540;
const M = 48;
const D = 14;
/** The scene's own clock, repeated: the scene's loop divides the explainer's. */
const PERIOD = 2;

/** What the snippet shows, as it is in scene.tsx but for the two lines noted in the test. */
export const source = `import { ease, motion, render } from "svjeez";
import { chick } from "./chick";

const hop = motion({ y: 60 })
  .to({ y: 0 }, { at: 0.4, over: 0.4 }, ease.out)
  .to({ y: 60 }, { at: 0.8, over: 0.4 }, ease.in);

export default () =>
  render(
    { width: 208, height: 240, duration: 2,
      title: "A chick hops" },
    chick({ body: hop }),
  );`;

/** The rules render() writes for that motion, with the whitespace added and the reduced-motion rule left out. */
export const shownCss = `.a {
  animation-duration: 2s;
  animation-iteration-count: infinite;
}
@keyframes k1 {
  0%, 20%, 60%, 100% {
    translate: 0px 60px;
  }
  40% {
    translate: 0px 0px;
  }
}
.m1 { animation-name: k1; }`;

/** The size of the file on disk, to a tenth of a KB. */
export const fileKb = (new TextEncoder().encode(scene()).length / 1024).toFixed(1);
export const fileLine = `scene.svg · ${fileKb} KB · 0 lines of JS`;

/** Three hues on ink: keywords are purple, names are blue, numbers are orange, and the rest is plain. */
const quiet = {
  ...theme,
  base0B: theme.base06,
  base0A: theme.base06,
  base08: theme.base06,
  base0C: theme.base06,
};

/** The one accent, and only the highlight uses it. */
const accent = theme.base0D;

const FONT = 16;
const LINE = 28;
const top = (H - 13 * LINE) / 2;

const style = { x: M, y: top, fontSize: FONT, lineHeight: LINE / FONT, theme: quiet, font: mono };
const tsx = code(highlight(source, "tsx") as CodeTokens, style);
const sheet = code(highlight(shownCss, "css") as CodeTokens, style);

/** The file line sits where the middle of the code was. */
const file = code([[fileLine]], { ...style, fontSize: 24, lineHeight: 1.4, y: H / 2 - 17 });

/** Each panel is one block: it fades with a 10px drift over half a second, eased out. */
const FADE = 0.5;
const DRIFT = 10;

/** The crossfades, in seconds on the loop: code to CSS, CSS to the file, the file back to code. */
const SWAP = { css: 4.6, file: 9.6, back: 13 } as const;

const into = (at: number) => ({ at, over: FADE });

const hidden = { opacity: 0, y: DRIFT };
const shown = { opacity: 1, y: 0 };
const gone = { opacity: 0, y: -DRIFT };

const panel = {
  tsx: motion(shown).at(SWAP.css).to(gone, FADE, ease.out).set(hidden).at(SWAP.back).to(shown, FADE, ease.out),
  css: motion(hidden).to(shown, into(SWAP.css), ease.out).at(SWAP.file).to(gone, FADE, ease.out).set(hidden),
  file: motion(hidden).to(shown, into(SWAP.file), ease.out).at(SWAP.back).to(gone, FADE, ease.out).set(hidden),
};

/** The highlight fades in as a whole bar, pulses each time the chick leaves the ground, and fades out before the swap. */
const bar = (lines: Rect, from: number, to: number) => (
  <g animation={motion({ opacity: 0 }).at(from).to({ opacity: 1 }, 0.4, ease.out).at(to).to({ opacity: 0 }, 0.3, ease.out)}>
    <rect
      x={lines.x - 12}
      y={lines.y}
      width={lines.w + 24}
      height={lines.h}
      rx={4}
      fill={accent}
      animation={pulse}
    />
  </g>
);

/** Up on the scene's 0.4s to 0.8s, every loop of its clock. */
const pulse = motion({ opacity: 0.1 })
  .at(0.4)
  .to({ opacity: 0.3 }, 0.4, ease.out)
  .to({ opacity: 0.1 }, 0.4, ease.in)
  .loop(PERIOD);

/** The picture: the scene itself, on its own 2s clock, as large as the right half allows. */
const SCALE = 2;
/** The chick spans y 29 to 222 of the scene, so that range, hop included, is what centers. */
const picture = rect(744 - 104 * SCALE, H / 2 - 125 * SCALE, 208 * SCALE, 240 * SCALE);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A scene in TSX compiles to one animated SVG",
      desc: "A short svjeez scene in TSX makes a chick hop. The timing line of the code is highlighted while the chick leaves the ground. The code then turns into the CSS keyframes svjeez writes for it, and then into the file: one SVG with no JavaScript.",
      reducedMotion: { at: 2.2 },
      css,
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />

      <g transform={`translate(${picture.x} ${picture.y}) scale(${SCALE})`}>{chick({ body: hop.loop(PERIOD) })}</g>

      <g animation={panel.tsx}>
        {bar(tsx.lines(5), 0.9, SWAP.css - 0.3)}
        {tsx.node}
      </g>
      <g animation={panel.css}>
        {bar(sheet.lines(9, 11), SWAP.css + FADE + 0.4, SWAP.file - 0.3)}
        {sheet.node}
      </g>
      <g animation={panel.file}>{file.node}</g>
    </>,
  );
}
