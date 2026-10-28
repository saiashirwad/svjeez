import { google } from "@svjeez/fonts";
import { ease, enter, motion, strokeFont } from "svjeez";
import { theme } from "../style";

export const W = 1280;
export const H = 720;

export const display = await google("Archivo Black");

export const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

export const C = {
  page: theme.base00,
  surface: theme.base01,
  hairline: theme.base02,
  muted: theme.base03,
  soft: theme.base04,
  text: theme.base05,
  ink: theme.base06,
  red: theme.base08,
  accent: theme.base09,
  green: theme.base0B,
} as const;

/** The house move: rise a little out of a soft blur. */
export const rise = (at: number, over = 0.45, y = 16) =>
  enter({ at, over }, { opacity: 0, y, blur: 6 }, ease.out);

/** A hard cut from hidden to shown. */
export const show = (at: number) => motion({ opacity: 0 }).at(at).set({ opacity: 1 });

export const centered = (text: string, size: number) => (W - display.measure(text, size)) / 2;

/** The call and its one-line gloss, bottom left, with an optional tag at the right. */
export const Caption = ({
  at,
  call,
  line,
  tag,
}: {
  at: number;
  call: string;
  line: string;
  tag?: string;
}) => (
  <g animation={rise(at, 0.4, 10)}>
    <text x={64} y={H - 88} fontSize={30} fill={C.ink}>
      {call}
    </text>
    <text x={64} y={H - 56} fontSize={14} fill={C.soft}>
      {line}
    </text>
    {tag && (
      <text x={W - 64} y={H - 56} fontSize={13} textAnchor="end" fill={C.muted}>
        {tag}
      </text>
    )}
  </g>
);
