import {
  Glyphs,
  def,
  draw,
  ease,
  enter,
  font,
  motion,
  render,
  type Child,
  type ElementProps,
  type Font,
  type SvgNode,
} from "svjeez";

const W = 720;
const H = 960;
const D = 11;

const load = (file: string, fallback: readonly string[]) =>
  font.load(new URL(`./${file}`, import.meta.url), { fallback });

const blackletter = await load("UnifrakturMaguntia-Book.ttf", ["serif"]);
const fat = await load("AbrilFatface-Regular.ttf", ["Georgia", "serif"]);
const body = await load("Lusitana-Regular.ttf", ["Georgia", "serif"]);

const C = {
  paper: "#F2ECDD",
  shade: "#E4DCC8",
  ink: "#1C1A16",
  soft: "#5B5548",
  red: "#B3261E",
  desk: "#2A2622",
} as const;

const PAGE = { x: 36, y: 36, w: W - 72, h: H - 72 };
const INNER = { x: PAGE.x + 28, w: PAGE.w - 56 };

const centered = (face: Font, text: string, size: number) =>
  INNER.x + (INNER.w - face.measure(text, size)) / 2;

/** A ruled line that draws on from the left. */
const rule = (y: number, at: number, weight = 1, x1 = INNER.x, x2 = INNER.x + INNER.w): Child => (
  <path
    d={`M${x1} ${y}H${x2}`}
    stroke={C.ink}
    strokeWidth={weight}
    animation={draw({ at, over: 0.6 }, ease.inOut)}
  />
);

type Line = { text: string; x: number }[];

/** Greedy line breaking measured in the real font, justified by spreading words across the column. A paragraph's last line stays ragged. */
const justify = (text: string, width: number, size: number): Line[] => {
  const space = body.measure(" ", size);
  const indent = size * 1.2;

  return text
    .trim()
    .split(/\n\s*\n/)
    .flatMap((paragraph) => {
      const rows: string[][] = [[]];

      for (const word of paragraph.split(/\s+/)) {
        const row = rows.at(-1)!;
        const room = rows.length === 1 ? width - indent : width;

        if (row.length && body.measure([...row, word].join(" "), size) > room) rows.push([word]);
        else row.push(word);
      }

      return rows.map((row, i) => {
        let x = i === 0 ? indent : 0;
        const ragged = i === rows.length - 1 || row.length === 1;
        const widths = row.map((word) => body.measure(word, size));

        const gap = ragged
          ? space
          : (width - x - widths.reduce((a, b) => a + b)) / (row.length - 1);

        return row.map((word, j) => ({ text: word, x: (x += j && widths[j - 1]! + gap) }));
      });
    });
};

const Row = ({ line, x, ...props }: ElementProps<"text"> & { line: Line; x: number }): SvgNode => (
  <text fontFamily={body} {...props}>
    {line.map((word) => (
      <tspan x={x + word.x}>{word.text} </tspan>
    ))}
  </text>
);

const ARTICLE = `
Type has arrived in the animated SVG. A scene can now load a real font file, embed it once, and set whole columns of text in it, measured to the pixel before the browser ever sees a glyph.

The letters at the top of this page are not text at all. Each one is an outline read straight from the font's glyph table, drawn on stroke by stroke and then filled. Outlines stay sharp at any zoom and embed no font, which suits a masthead.

This column is the other kind. It is real text in an embedded serif, so it can be selected, searched and read aloud. Every line was broken and justified ahead of time by measuring each word, kerning included, and each word was placed where the browser would put it.

Experts consulted for this report were unanimous. The 0.6em guess, long the standard for a label's width, has been retired. Diagram boxes now fit their labels, callouts fit their notes, and code sits on its columns in any monospaced face.

Readers are advised that a whole font downloads before the first frame. Editors recommend outlines for short titles and an embedded face for body copy, which keeps a page like this one well under a hundred kilobytes.

The halftone letter on this page shows what outlines allow. A glyph is a shape like any other, so it takes a gradient, a pattern or a filter, and it can be scaled to fill a frame without a single blurred edge.

Ligatures and kerning came along for the ride. A pair such as AV tucks together exactly as it does in the browser, because the same tables the browser reads were read here first. Where a font lacks a letter, the fallback named alongside it takes over.

Nothing on this page was fetched from the web. The three typefaces travel inside the file as data, the motion runs as plain CSS keyframes, and the whole edition plays wherever an image does, from a README to a slide.

Printers of an earlier age set every line by hand and justified it with thin strips of lead. This edition was set by a few lines of TypeScript that weigh each word before placing it. The compositors' union has been informed.

In other news, the masthead above is set in a blackletter cut that would have looked at home on a broadsheet two centuries ago. It costs nothing to embed, because it is not embedded. Only its outlines made the trip.

Continued on page A2.
`;

const COLUMN = { y: 404, gap: 20, size: 11.5, leading: 15.5 };
const columnWidth = (INNER.w - 2 * COLUMN.gap) / 3;
const columnX = (i: number) => INNER.x + i * (columnWidth + COLUMN.gap);

const PHOTO = { x: columnX(1), y: COLUMN.y, w: columnWidth, h: 196 };

const halftone = def.pattern(
  { width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
  <circle cx={2.5} cy={2.5} r={1.55} fill={C.ink} />,
);

const rows = Math.floor((PAGE.y + PAGE.h - 40 - COLUMN.y) / COLUMN.leading);
const photoRows = Math.ceil((PHOTO.h + 52) / COLUMN.leading);
const rest = justify(ARTICLE, columnWidth, COLUMN.size);
const columns = [rows, rows - photoRows, rows].map((count) => rest.splice(0, count));

if (rest.length)
  throw new Error(`The article overruns its columns by ${rest.length} lines. Cut it.`);

const SPIN = 1.8;
const MAST = "The Svjeez Gazette";
const MAST_SIZE = 66;
const HEAD = ["TYPE ARRIVES", "IN EVERY SVG"];
const HEAD_SIZE = 58;
const DECK = "Letters draw themselves, columns justify by measure, and nothing loads from the web.";

function Masthead(): SvgNode {
  const x = centered(blackletter, MAST, MAST_SIZE);
  const y = 152;

  return (
    <>
      <Glyphs
        font={blackletter}
        text={MAST}
        size={MAST_SIZE}
        x={x}
        y={y}
        fill="none"
        stroke={C.ink}
        strokeWidth={1.1}
        alt=""
        animation={(_, i) => draw({ at: SPIN + 0.1 + i * 0.07, over: 0.9 }, ease.inOut)}
      />
      <Glyphs
        font={blackletter}
        text={MAST}
        size={MAST_SIZE}
        x={x}
        y={y}
        fill={C.ink}
        animation={(_, i) =>
          motion({ opacity: 0 })
            .at(SPIN + 0.7 + i * 0.07)
            .to({ opacity: 1 }, 0.5)
        }
      />
    </>
  );
}

function Dateline(): SvgNode {
  const y = 194;
  const small = 11;

  const items: [string, number][] = [
    ["VOL. I  No. 1", INNER.x],
    ["TUESDAY, OCTOBER 27, 2026", centered(body, "TUESDAY, OCTOBER 27, 2026", small)],
    ["ONE CENT", INNER.x + INNER.w - body.measure("ONE CENT", small)],
  ];

  return (
    <g
      fontFamily={body}
      fontSize={small}
      fill={C.soft}
      animation={enter({ at: SPIN + 0.9, over: 0.5 }, { opacity: 0 })}
    >
      {items.map(([text, x]) => (
        <text x={x} y={y}>
          {text}
        </text>
      ))}
    </g>
  );
}

function Headline(): SvgNode {
  return (
    <>
      {HEAD.map((line, row) => {
        const offset = HEAD.slice(0, row).join("").length;

        return (
          <Glyphs
            font={fat}
            text={line}
            size={HEAD_SIZE}
            x={centered(fat, line, HEAD_SIZE)}
            y={270 + row * 62}
            fill={C.ink}
            animation={(_, i) =>
              enter(
                { at: 3.4 + (offset + i) * 0.045, over: 0.45 },
                { opacity: 0, y: -28, scale: 1.4 },
                ease.pop,
              )
            }
          />
        );
      })}
    </>
  );
}

function Deck(): SvgNode {
  const size = 15;

  return (
    <text
      x={centered(body, DECK, size)}
      y={372}
      fontFamily={body}
      fontSize={size}
      fill={C.soft}
      animation={enter({ at: 4.7, over: 0.6 }, { opacity: 0, y: 6 })}
    >
      {DECK}
    </text>
  );
}

function Columns(): SvgNode {
  let index = 0;

  return (
    <>
      {columns.map((lines, i) =>
        lines.map((line, row) => (
          <Row
            line={line}
            x={columnX(i)}
            y={COLUMN.y + 10 + (i === 1 ? photoRows : 0) * COLUMN.leading + row * COLUMN.leading}
            fontSize={COLUMN.size}
            fill={C.ink}
            animation={enter({ at: 5 + index++ * 0.028, over: 0.25 }, { opacity: 0 })}
          />
        )),
      )}
    </>
  );
}

function Photo(): SvgNode {
  const letter = "A";
  const size = 210;
  const x = PHOTO.x + (PHOTO.w - fat.measure(letter, size)) / 2;
  const caption = "The letter A, set as outlines and filled with a halftone screen.";

  const lines = justify(caption, PHOTO.w, 10.5);

  return (
    <g animation={enter({ at: 6.2, over: 0.6 }, { opacity: 0 })}>
      <rect
        x={PHOTO.x}
        y={PHOTO.y}
        width={PHOTO.w}
        height={PHOTO.h}
        fill={C.shade}
        stroke={C.ink}
        strokeWidth={0.75}
      />
      <g
        animation={motion({ scale: 0.6, opacity: 0 })
          .at(6.3)
          .to({ scale: 1, opacity: 1 }, 0.9, ease.out)}
      >
        <Glyphs
          font={fat}
          text={letter}
          size={size}
          x={x}
          y={PHOTO.y + PHOTO.h - 26}
          fill={halftone}
          alt="A halftone letter A"
        />
      </g>
      {lines.map((line, row) => (
        <Row
          line={line}
          x={PHOTO.x}
          y={PHOTO.y + PHOTO.h + 18 + row * 13}
          fontSize={10.5}
          fill={C.soft}
        />
      ))}
    </g>
  );
}

function Stamp(): SvgNode {
  const text = "EXTRA!";
  const size = 54;
  const width = fat.measure(text, size);
  const [cx, cy] = [columnX(2) + columnWidth / 2, 520];

  return (
    <g transform={`translate(${cx} ${cy}) rotate(-14)`}>
      <g
        animation={motion({ opacity: 0, scale: 3 })
          .at(8.2)
          .to({ opacity: 1, scale: 1 }, 0.35, ease.in)}
      >
        <rect
          x={-width / 2 - 12}
          y={-size * 0.62}
          width={width + 24}
          height={size * 1.04}
          rx={4}
          fill="none"
          stroke={C.red}
          strokeWidth={3}
        />
        <Glyphs
          font={fat}
          text={text}
          size={size}
          x={-width / 2}
          y={size * 0.28}
          fill={C.red}
          opacity={0.92}
        />
      </g>
    </g>
  );
}

export default function build(): string {
  const page = (
    <>
      <rect
        x={PAGE.x + 6}
        y={PAGE.y + 8}
        width={PAGE.w}
        height={PAGE.h}
        fill="#000"
        opacity={0.35}
      />
      <rect x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.h} fill={C.paper} />
      {rule(78, SPIN, 0.75)}
      <Masthead />
      {rule(170, SPIN + 0.4, 2.5)}
      {rule(176, SPIN + 0.5, 0.75)}
      <Dateline />
      {rule(204, SPIN + 0.6, 0.75)}
      <Headline />
      {rule(388, 4.6, 0.75)}
      <Deck />
      {[1, 2].map((i) => (
        <path
          d={`M${columnX(i) - COLUMN.gap / 2} ${COLUMN.y + 2}V${PAGE.y + PAGE.h - 34}`}
          stroke={C.ink}
          strokeWidth={0.5}
          animation={draw({ at: 4.9 + i * 0.1, over: 0.8 })}
        />
      ))}
      <Columns />
      <Photo />
      <Stamp />
    </>
  );

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "The Svjeez Gazette",
      desc: "A newspaper spins in and lands. Its blackletter masthead draws on letter by letter, the headline TYPE ARRIVES IN EVERY SVG drops in, three justified columns of text fade in line by line beside a halftone letter A, and a red EXTRA! stamp slams onto the page.",
      reducedMotion: { at: D - 0.5 },
    },
    <>
      <rect width={W} height={H} fill={C.desk} />
      <g
        animation={[
          motion({ scale: 0.04, rotate: -1080, opacity: 0 }).to(
            { scale: 1, rotate: 0, opacity: 1 },
            SPIN,
            ease.out,
          ),
          motion().at(8.5).to({ scale: 1.012 }, 0.08).to({ scale: 1 }, 0.25, ease.out),
        ]}
      >
        {page}
      </g>
    </>,
  );
}
