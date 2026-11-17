// A release announcement as a template: the version, a title and the highlights are params, so the same scene draws
// every release. `svjeez svg release-card/index.tsx --params release-card/data.json` renders the one in data.json.
import { ease, enter, motion, render, span, stagger } from "svjeez";
import { defaults, list, text, type Values } from "svjeez/params";

import {
  color,
  css,
  geist,
  HEIGHT,
  MARGIN,
  mono,
  RADIUS,
  rise,
  WIDTH,
} from "../gallery-style";

export const params = {
  version: text("0.8.0", { maxLength: 12, label: "version" }),
  title: text("Every scene is a template", { maxLength: 34 }),
  highlights: list(
    text("", { maxLength: 60 }),
    [
      "Text and list params, checked against the schema",
      "--params data.json on svg, frames, video and check",
      "svjeez dev ships in the CLI, with a scrubber",
    ],
    { min: 1, max: 5, label: "highlights" },
  ),
};

const D = 8;
const PAD = 48;

/** From the card's top edge: the first highlight's baseline. */
const FIRST = 230;
const BOX_WIDTH = WIDTH - 2 * MARGIN;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const card = span(0.2, 0.6);
  const tag = card.next(0.5, -0.2);
  const heading = tag.next(0.6, -0.2);
  const rows = stagger(heading.next(0.5, 0.1), p.highlights.length, 0.18);
  const tagWidth = 28 + p.version.length * 13;
  // The card is as tall as its content, centered on the page, and rows close up when five would overflow.
  const row = Math.min(54, (HEIGHT - 2 * MARGIN - FIRST - PAD) / Math.max(1, p.highlights.length - 1));
  const height = FIRST + (p.highlights.length - 1) * row + PAD;
  const CARD = { x: MARGIN, y: (HEIGHT - height) / 2, width: BOX_WIDTH, height };
  const top = CARD.y + FIRST;
  const out = motion({ opacity: 1 }).to({ opacity: 0 }, span(D - 1.4, 1), ease.inOut);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: `svjeez ${p.version}: ${p.title}`,
      desc: `A release card for version ${p.version}, titled "${p.title}". Its highlights rise in one by one: ${p.highlights.join("; ")}.`,
      css,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={out}>
        <rect
          {...CARD}
          rx={RADIUS}
          fill={color.panel}
          // A hairline `edge` vanishes against a light page; `faint` shows the card's outline in both schemes.
          stroke={color.faint}
          strokeWidth={1.5}
          animation={enter(card, { opacity: 0, scale: 0.98 }, ease.out)}
        />
        <g animation={rise(tag.at, tag.over)}>
          <rect
            x={CARD.x + PAD}
            y={CARD.y + PAD}
            width={tagWidth}
            height={32}
            rx={16}
            fill={color.accent}
          />
          <text
            x={CARD.x + PAD + tagWidth / 2}
            y={CARD.y + PAD + 22}
            textAnchor="middle"
            fontFamily={mono}
            fontSize={18}
            fontWeight={600}
            fill={color.bg}
          >
            {`v${p.version}`}
          </text>
        </g>
        <text
          x={CARD.x + PAD}
          y={CARD.y + PAD + 112}
          fontFamily={geist}
          fontSize={44}
          fontWeight={600}
          fill={color.ink}
          animation={rise(heading.at, heading.over)}
        >
          {p.title}
        </text>
        <line
          x1={CARD.x + PAD}
          y1={top - 36}
          x2={CARD.x + CARD.width - PAD}
          y2={top - 36}
          stroke={color.edge}
          animation={enter(heading.last(0.4))}
        />
        {p.highlights.map((line, i) => (
          <g animation={rise(rows[i]!.at, rows[i]!.over)}>
            <circle cx={CARD.x + PAD + 6} cy={top + i * row - 8} r={5} fill={color.accent} />
            <text
              x={CARD.x + PAD + 26}
              y={top + i * row}
              fontFamily={geist}
              fontSize={24}
              fill={color.text}
            >
              {line}
            </text>
          </g>
        ))}
      </g>
    </>,
  );
}
