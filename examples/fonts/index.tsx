import { google } from "@svjeez/fonts";
import { Glyphs, draw, ease, enter, motion, render } from "svjeez";

import { HEIGHT, WIDTH, color, css, hue, leave, mono, size } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;
const D = 8;

const display = await google("Archivo Black");
const body = await google.family("ABeeZee", [{ weight: 400 }, { weight: 400, style: "italic" }]);

const TITLE = "Typography";
const TITLE_SIZE = Math.min(120, 760 / display.measure(TITLE, 1));
const titleX = (W - display.measure(TITLE, TITLE_SIZE)) / 2;

const LINE = "Sphinx of black quartz, judge my vow.";
const ITALIC = "Pack my box with five dozen liquor jugs.";
const LINE_SIZE = 28;
const regular = body.face(400);
const lineWidth = regular.measure(LINE, LINE_SIZE);
const italicWidth = body.face(400, "italic").measure(ITALIC, LINE_SIZE);

/** A face's name, small and centered under what is set in it. */
const Name = ({ name, y, at }: { name: string; y: number; at: number }) => (
  <text
    x={W / 2}
    y={y}
    textAnchor="middle"
    fontFamily={mono}
    fontSize={size.label}
    fill={color.dim}
    animation={enter({ at, over: 0.5 }, { opacity: 0, y: 8 }, ease.out)}
  >
    {name}
  </text>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Type specimen",
      css,
      desc: "Two typefaces: a display face drawn on as outlines, then body text in a regular and an italic.",
    },
    <>
      <rect width={W} height={H} fill={color.bg} />
      <g animation={leave(D)}>
        <Glyphs
          font={display}
          text={TITLE}
          size={TITLE_SIZE}
          x={titleX}
          y={210}
          fill="none"
          stroke={hue.orange}
          strokeWidth={2}
          animation={(_, i) => draw({ at: 0.2 + i * 0.1, over: 1 }, ease.inOut)}
        />
        <Glyphs
          font={display}
          text={TITLE}
          size={TITLE_SIZE}
          x={titleX}
          y={210}
          fill={hue.blue}
          alt=""
          animation={(_, i) =>
            enter({ at: 1 + i * 0.08, over: 0.5 }, { opacity: 0, y: 8 }, ease.out)
          }
        />
        <Name name="Archivo Black" y={270} at={1.8} />
        <g animation={enter({ at: 2.2, over: 0.5 }, { opacity: 0, y: 8 }, ease.out)}>
          <text
            x={(W - lineWidth) / 2}
            y={330}
            fontFamily={body}
            fontSize={LINE_SIZE}
            fill={color.ink}
          >
            {LINE}
          </text>
          <text
            x={(W - italicWidth) / 2}
            y={372}
            fontFamily={body}
            fontStyle="italic"
            fontSize={LINE_SIZE}
            fill={hue.purple}
          >
            {ITALIC}
          </text>
        </g>
        <rect
          x={(W - lineWidth) / 2}
          y={390}
          width={lineWidth}
          height={2}
          rx={1}
          fill={hue.orange}
          animation={motion({ scale: 0 }).at(2.6).to({ scale: 1 }, 0.6, ease.out)}
        />
        <Name name="ABeeZee" y={420} at={2.8} />
      </g>
    </>,
  );
}
