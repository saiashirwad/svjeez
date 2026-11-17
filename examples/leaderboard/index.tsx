import { ease, motion, readout, easeAt, render, span, stagger } from "svjeez";
import { defaults, list, number, text, type Values } from "svjeez/params";

import {
  color,
  css,
  geist,
  HEIGHT,
  MARGIN,
  motions,
  mono,
  rise,
  SUBTITLE,
  Title,
  WIDTH,
} from "../gallery-style";

export const params = {
  title: text("Most merged pull requests", { maxLength: 44 }),
  subtitle: text("October, by author", { maxLength: 60 }),
  rows: list(
    { name: text("", { maxLength: 22 }), score: number(0, { min: 0, max: 99_999, step: 1 }) },
    [
      { name: "ada", score: 48 },
      { name: "grace", score: 61 },
      { name: "linus", score: 37 },
      { name: "margaret", score: 55 },
      { name: "ken", score: 29 },
      { name: "barbara", score: 22 },
    ],
    { min: 1, max: 8 },
  ),
};

const D = 9;
const TOP = 140;
const BOTTOM = HEIGHT - MARGIN;
const NAME = MARGIN + 56;
const BAR = MARGIN + 300;
const SCORE = WIDTH - MARGIN;
const LONGEST = SCORE - 96 - BAR;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const rows = [...p.rows].sort((a, b) => b.score - a.score);
  const height = Math.min(56, (BOTTOM - TOP) / rows.length);
  const best = Math.max(1, rows[0]!.score);
  const arrive = stagger(span(0.6, 0.5), rows.length, 0.12);
  const grow = arrive.map((row) => span(row.at, 1.3));
  const out = motion({ opacity: 1 }).to({ opacity: 0 }, span(D - 1.4, 1), ease.inOut);

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: `${p.subtitle}. ${rows.map((row, i) => `${i + 1}. ${row.name}, ${row.score}`).join("; ")}. Rows rise in from first to last and their bars grow to their scores.`,
      css,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={out}>
        <Title title={p.title} />
        <text
          x={SUBTITLE.x}
          y={SUBTITLE.y + 6}
          fontFamily={geist}
          fontSize={20}
          fill={color.dim}
          animation={rise(motions.lead)}
        >
          {p.subtitle}
        </text>
        {rows.map((row, i) => {
          const y = TOP + i * height;
          const middle = y + height / 2;
          const width = Math.max(2, (row.score / best) * LONGEST);
          const fill = i === 0 ? color.accent : color.faint;
          const bar = grow[i]!;

          return (
            <g animation={rise(arrive[i]!.at, arrive[i]!.over)}>
              {i > 0 && <line x1={MARGIN} y1={y} x2={SCORE} y2={y} stroke={color.edge} />}
              <text x={MARGIN} y={middle + 7} fontFamily={mono} fontSize={20} fill={color.dim}>
                {String(i + 1).padStart(2, " ")}
              </text>
              <text
                x={NAME}
                y={middle + 7}
                fontFamily={geist}
                fontSize={20}
                fontWeight={i === 0 ? 600 : 400}
                fill={color.ink}
              >
                {row.name}
              </text>
              <rect
                x={BAR}
                y={middle - 9}
                width={width}
                height={18}
                rx={4}
                fill={fill}
                animation={motion({ width: 0 }).to({ width }, bar, ease.out)}
              />
              {readout(
                bar,
                (t) =>
                  String(
                    Math.round(row.score * easeAt(ease.out, Math.min(1, (t - bar.at) / bar.over))),
                  ),
                {
                  x: SCORE,
                  y: middle + 7,
                  textAnchor: "end",
                  fontFamily: mono,
                  fontSize: 20,
                  fill: color.text,
                },
              )}
            </g>
          );
        })}
      </g>
    </>,
  );
}
