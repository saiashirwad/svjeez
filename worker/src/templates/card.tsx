import { ease, enter, motion, render, span, stagger, type Drawn } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
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
} from "../../../examples/gallery-style";
import { block, charsIn, fitSize } from "../block";

export const params = {
  tag: text("v0.8.0", {
    maxLength: 40,
    label:
      "A short pill above the title: a version, a date or a category such as NEW. At most 40 characters; empty for none.",
  }),
  title: text("Every scene is a template", {
    maxLength: 60,
    label:
      "The card's headline. At most 60 characters; up to about 30 show at full size, longer ones are set smaller.",
  }),
  bullets: list(
    text("", {
      maxLength: 110,
      label:
        "One point, a short sentence without a trailing period. At most 110 characters; up to about 60 show at full size, longer ones set all the points smaller.",
    }),
    [
      "Text and list params, checked against the schema",
      "--params data.json on svg, frames, video and check",
      "svjeez dev ships in the CLI, with a scrubber",
    ],
    { min: 1, max: 6, label: "The points that rise in under the title, 1 to 6." },
  ),
};

const D = 8;
const PAD = 48;

const FIRST = 230;
const BOX_WIDTH = WIDTH - 2 * MARGIN;

/** The card centered in `box`: tag, title, a rule, and the points rising in. No tag draws no pill. */
export const cardBlock = (p: Values<typeof params>, box: Rect): Drawn => {
  const card = span(0.2, 0.6);
  const tag = card.next(0.5, -0.2);
  const heading = tag.next(0.6, -0.2);
  const rows = stagger(heading.next(0.5, 0.1), p.bullets.length, 0.18);
  const tagWidth = 28 + p.tag.length * 13;
  const row = Math.min(54, (box.h - FIRST - PAD) / Math.max(1, p.bullets.length - 1));
  const width = box.w - 2 * PAD;
  const titleSize = fitSize(geist.face(600), [p.title], 44, width, 22);

  const size = fitSize(
    geist.face(400),
    p.bullets,
    Math.min(24, Math.floor(row * 0.6)),
    width - 26,
    14,
  );

  if (titleSize === undefined)
    throw new Error(
      `title "${p.title}" is too long to fit across the card; about ${charsIn(geist.face(600), width, 22)} characters fit. Shorten it.`,
    );

  if (size === undefined)
    throw new Error(
      `a bullet is too long to fit across the card; about ${charsIn(geist.face(400), width - 26, 14)} characters fit. Shorten the longest, or split it in two.`,
    );

  const height = FIRST + (p.bullets.length - 1) * row + PAD;
  const CARD = { x: box.x, y: box.y + (box.h - height) / 2, width: box.w, height };
  const top = CARD.y + FIRST;

  return block(
    <>
      <rect
        {...CARD}
        rx={RADIUS}
        fill={color.panel}
        stroke={color.faint}
        strokeWidth={1.5}
        animation={enter(card, { opacity: 0, scale: 0.98 }, ease.out)}
      />
      {p.tag && (
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
            {p.tag}
          </text>
        </g>
      )}
      <text
        x={CARD.x + PAD}
        y={CARD.y + PAD + 112}
        fontFamily={geist}
        fontSize={titleSize}
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
      {p.bullets.map((line, i) => (
        <g animation={rise(rows[i]!.at, rows[i]!.over)}>
          <circle cx={CARD.x + PAD + 6} cy={top + i * row - size / 3} r={5} fill={color.accent} />
          <text
            x={CARD.x + PAD + 26}
            y={top + i * row}
            fontFamily={geist}
            fontSize={size}
            fill={color.text}
          >
            {line}
          </text>
        </g>
      ))}
    </>,
    span(card.at, rows.at(-1)!.end - card.at),
    rect(CARD.x, CARD.y, CARD.width, CARD.height),
  );
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = cardBlock(p, rect(MARGIN, MARGIN, BOX_WIDTH, HEIGHT - 2 * MARGIN));
  const out = motion({ opacity: 1 }).to({ opacity: 0 }, span(D - 1.4, 1), ease.inOut);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: `${p.tag}: ${p.title}`,
      desc: `A card tagged ${p.tag}, titled "${p.title}". Its points rise in one by one: ${p.bullets.join("; ")}.`,
      css,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={out}>{drawn.node}</g>
    </>,
  );
}
