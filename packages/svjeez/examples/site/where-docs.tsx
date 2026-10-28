import { ease, motion, render } from "svjeez";
import { CSS, chrome, skeleton } from "./kit";
import { theme } from "../style";

// A docs page: sidebar, text, and a diagram image whose packet keeps travelling.
const W = 328;
const H = 264;
const D = 4;
const SIDE = 84;
const win = chrome(W, H, "Docs", { bar: 36 });
const from = SIDE + 28;
const to = W - 44;

export default function build(): string {
  return render(
    { width: W, height: H, duration: D, title: "In the docs", desc: "A documentation page with a sidebar, text and a diagram in which a packet travels from one box to the other.", css: CSS, reducedMotion: { at: 1.5 } },
    <>
      {win.node}
      <path d={`M0.5 36H${SIDE}V${H - 12.5}a12 12 0 0 1 -12 12H12.5a12 12 0 0 1 -12 -12Z`} fill={theme.base01} />
      <path d={`M${SIDE} 36V${H}`} stroke={theme.base02} />
      <rect x={10} y={50} width={SIDE - 20} height={22} rx={6} fill={theme.base0D} />
      <rect x={20} y={57} width={34} height={8} rx={4} fill="#fff" opacity={0.9} />
      {skeleton(20, 90, [44, 52, 38, 48], { gap: 24, fill: theme.base02 })}
      <rect x={SIDE + 20} y={52} width={110} height={13} rx={6.5} fill={theme.base06} />
      {skeleton(SIDE + 20, 82, [200, 180])}
      <rect x={SIDE + 20} y={124} width={W - SIDE - 40} height={96} rx={9} fill={theme.base01} stroke={theme.base02} />
      <rect x={SIDE + 34} y={152} width={34} height={40} rx={8} fill={theme.base0D} opacity={0.18} stroke={theme.base0D} />
      <rect x={W - 36 - 34 + 12} y={152} width={34} height={40} rx={8} fill={theme.base0B} opacity={0.18} stroke={theme.base0B} />
      <path d={`M${from + 14} 172H${to - 16}`} stroke={theme.base03} strokeWidth={1.5} strokeDasharray="3 4" />
      <circle cx={from} cy={172} r={5} fill={theme.base0D} animation={motion({ x: 0 }).at(0.4).to({ x: to - from - 24 }, 2.4, ease.inOut)} />
      {skeleton(SIDE + 20, 236, [150])}
    </>,
  );
}
