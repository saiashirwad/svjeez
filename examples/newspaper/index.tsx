import { google } from "@svjeez/fonts";
import { leave } from "../gallery-style";
import {
  Glyphs,
  def,
  draw,
  ease,
  enter,
  motion,
  render,
  type Child,
  type ElementProps,
  type Font,
  type SvgNode,
  span,
  stagger,
} from "svjeez";

const W = 1280;
const H = 720;
const D = 9;

/** The page fills the canvas, inside a 64px margin (48px at 960 wide). */
const EDGE = 64;

const blackletter = await google("UnifrakturMaguntia", { fallback: ["serif"] });
const fat = await google("Abril Fatface", { fallback: ["Georgia", "serif"] });
const body = await google("Lusitana", { fallback: ["Georgia", "serif"] });

const C = {
  paper: "#F2ECDD",
  shade: "#E4DCC8",
  ink: "#1C1A16",
  soft: "#5B5548",
} as const;

const INNER = { x: EDGE, w: W - 2 * EDGE };

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
HOUSTON, July 20 - Two American astronauts landed on the Moon today and walked on its surface, eight years after President Kennedy set the goal. The lunar module Eagle touched down in the Sea of Tranquility at 4:17 p.m. Eastern time.

"Houston, Tranquility Base here," Neil Armstrong reported. "The Eagle has landed." Mission control, which had held its breath through the last minutes of the descent, replied that it was breathing again.

At 10:56 p.m. Armstrong, the 38-year-old commander, stepped onto the surface. "That's one small step for man," he said, "one giant leap for mankind." Edwin Aldrin, 39, followed about twenty minutes later and called the view "magnificent desolation."

The two men spent about two and a half hours outside. They planted an American flag, set up a seismometer and a laser reflector, and gathered about 47 pounds of lunar rock and soil. A plaque left on the lander reads: "We came in peace for all mankind."

President Nixon spoke with the astronauts by radio-telephone from the White House. He called it the most historic telephone call ever made from there.

The landing was not without trouble. Computer alarms sounded during the descent, and Armstrong took manual control to steer past a field of boulders.

Michael Collins, 38, orbited the Moon alone aboard the command module Columbia while his crewmates were on the surface.

The flight began on July 16 with the launch of a Saturn V rocket from Cape Kennedy, Fla., and reached the Moon on the fourth day. An estimated 600 million people watched the first steps on television.

The astronauts are to lift off from the Moon later today and return to Earth for a splashdown in the Pacific on Thursday.

Continued on page A2.
`;

// Five columns: the story runs down the first four under the headline, and the photo stands in the fifth.
const COLUMN = { y: 318, gap: 22, size: 14, leading: 21.5 };
const BOTTOM = H - EDGE;
const columnWidth = (INNER.w - 4 * COLUMN.gap) / 5;
const columnX = (i: number) => INNER.x + i * (columnWidth + COLUMN.gap);
const STORY = { x: INNER.x, w: columnX(4) - COLUMN.gap - INNER.x };

const PHOTO = { x: columnX(4), y: 198, w: columnWidth, h: columnWidth };

const halftone = def.pattern(
  { width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
  <circle cx={2.5} cy={2.5} r={1.55} fill={C.ink} />,
);

const rows = Math.floor((BOTTOM - COLUMN.y) / COLUMN.leading);
const rest = justify(ARTICLE, columnWidth, COLUMN.size);
const perColumn = Math.ceil(rest.length / 4);
const columns = [0, 1, 2, 3].map(() => rest.splice(0, Math.min(rows, perColumn)));

if (rest.length)
  throw new Error(`The article overruns its columns by ${rest.length} lines. Cut it.`);

const MAST = "The Daily Chronicle";
const MAST_SIZE = 64;
const HEAD = "ASTRONAUTS LAND ON THE MOON";
const HEAD_SIZE = Math.min(64, STORY.w / fat.measure(HEAD, 1));

const DECK =
  "Armstrong and Aldrin spend two and a half hours on the surface; Collins waits in orbit.";

function Masthead(): SvgNode {
  const x = centered(blackletter, MAST, MAST_SIZE);
  const y = 132;

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
        animation={(_, each) => draw(each.stagger(span(0.2, 0.9), 0.07), ease.inOut)}
      />
      <Glyphs
        font={blackletter}
        text={MAST}
        size={MAST_SIZE}
        x={x}
        y={y}
        fill={C.ink}
        animation={(_, each) =>
          motion({ opacity: 0 }).to({ opacity: 1 }, each.stagger(span(0.8, 0.5), 0.07))
        }
      />
    </>
  );
}

function Dateline(): SvgNode {
  const y = 176;
  const small = 12;
  const day = "MONDAY, JULY 21, 1969";
  const price = "TEN CENTS";

  const items: [string, number][] = [
    [day, centered(body, day, small)],
    [price, INNER.x + INNER.w - body.measure(price, small)],
  ];

  return (
    <g
      fontFamily={body}
      fontSize={small}
      fill={C.soft}
      animation={enter({ at: 0.9, over: 0.5 }, { opacity: 0 })}
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
    <Glyphs
      font={fat}
      text={HEAD}
      size={HEAD_SIZE}
      x={STORY.x + (STORY.w - fat.measure(HEAD, HEAD_SIZE)) / 2}
      y={252}
      fill={C.ink}
      animation={(_, each) =>
        enter(each.stagger(span(1.3, 0.45), 0.04), { opacity: 0, y: -16 }, ease.out)
      }
    />
  );
}

function Deck(): SvgNode {
  const size = 15;

  return (
    <text
      x={STORY.x + (STORY.w - body.measure(DECK, size)) / 2}
      y={286}
      fontFamily={body}
      fontSize={size}
      fill={C.soft}
      animation={enter({ at: 2.3, over: 0.6 }, { opacity: 0, y: 6 })}
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
            y={COLUMN.y + 10 + row * COLUMN.leading}
            fontSize={COLUMN.size}
            fill={C.ink}
            animation={enter({ at: 2.4 + index++ * 0.025, over: 0.25 }, { opacity: 0 })}
          />
        )),
      )}
    </>
  );
}

function Photo(): SvgNode {
  const r = (PHOTO.w - 40) / 2;
  const [cx, cy] = [PHOTO.x + PHOTO.w / 2, PHOTO.y + PHOTO.h / 2];
  const disc = def.clipPath({}, <circle cx={cx} cy={cy} r={r} />);

  const crew = [
    ["Neil Armstrong, 38", "Commander"],
    ["Edwin Aldrin, 39", "Lunar module pilot"],
    ["Michael Collins, 38", "Command module pilot"],
  ] as const;

  const top = PHOTO.y + PHOTO.h + 40;

  return (
    <>
      <g animation={enter({ at: 2.8, over: 0.6 }, { opacity: 0 })}>
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
          animation={motion({ scale: 0.8, opacity: 0 }).to(
            { scale: 1, opacity: 1 },
            span(2.9, 0.8),
            ease.out,
          )}
        >
          <circle cx={cx} cy={cy} r={r} fill={C.paper} />
          <circle cx={cx} cy={cy} r={r} fill={halftone} />
          <g clipPath={disc}>
            <circle cx={cx + r * 0.55} cy={cy} r={r * 1.05} fill={C.shade} opacity={0.9} />
          </g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.ink} strokeWidth={0.75} />
        </g>
      </g>
      <g fontFamily={body} animation={enter({ at: 3.3, over: 0.6 }, { opacity: 0 })}>
        <Glyphs font={fat} text="The crew" size={17} x={PHOTO.x} y={top} fill={C.ink} />
        {crew.map(([name, role], i) => (
          <g>
            <text x={PHOTO.x} y={top + 30 + i * 44} fontSize={14} fill={C.ink}>
              {name}
            </text>
            <text x={PHOTO.x} y={top + 48 + i * 44} fontSize={13} fill={C.soft}>
              {role}
            </text>
          </g>
        ))}
      </g>
    </>
  );
}

export default function build(): string {
  const page = (
    <>
      {rule(EDGE, 0.1, 0.75)}
      <Masthead />
      {rule(146, 0.3, 2.5)}
      {rule(152, 0.4, 0.75)}
      <Dateline />
      {rule(186, 0.5, 0.75)}
      <Headline />
      {rule(302, 2.2, 0.75, STORY.x, STORY.x + STORY.w)}
      <Deck />
      <path
        d={`M${columnX(4) - COLUMN.gap / 2} ${PHOTO.y}V${BOTTOM}`}
        stroke={C.ink}
        strokeWidth={0.5}
        animation={draw({ at: 2.4, over: 0.8 })}
      />
      {stagger(span(2.6, 0.8), 3, 0.1).map((rule, i) => (
        <path
          d={`M${columnX(i + 1) - COLUMN.gap / 2} ${COLUMN.y + 2}V${BOTTOM}`}
          stroke={C.ink}
          strokeWidth={0.5}
          animation={draw(rule)}
        />
      ))}
      <Columns />
      <Photo />
    </>
  );

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Newspaper front page",
      desc: "A newspaper front page sets itself: the masthead draws on, the headline drops in, and four justified columns fill with text.",
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width={W} height={H} fill={C.paper} />
      <g animation={leave(D)}>{page}</g>
    </>,
  );
}
