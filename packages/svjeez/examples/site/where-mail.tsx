import { ease, motion, render } from "svjeez";
import { CSS, chrome, outro, skeleton, theme } from "./kit";

// An email: no scripts run in a mail client, and an animated SVG still plays where images do.
const W = 328;
const H = 264;
const D = 6;
const win = chrome(W, H, "Inbox", { bar: 36 });
const heights = [34, 52, 44, 68, 80];

export default function build(): string {
  return render(
    { width: W, height: H, duration: D, title: "In an email", desc: "An email with a sender, a subject and an animated bar chart that grows inside the message.", css: CSS, reducedMotion: { at: 3 } },
    <>
      {win.node}
      <circle cx={42} cy={68} r={14} fill={theme.base0E} opacity={0.85} />
      <rect x={66} y={58} width={80} height={8} rx={4} fill={theme.base06} />
      <rect x={66} y={74} width={120} height={7} rx={3.5} fill={theme.base02} />
      <text class="sans" x={24} y={112} fontSize={15} fontWeight={700} fill={theme.base06}>Your weekly report</text>
      <rect x={24} y={126} width={W - 48} height={98} rx={9} fill={theme.base01} stroke={theme.base02} />
      <g animation={outro(D)}>
      {heights.map((h, i) => (
        <rect x={52 + i * 46} y={212 - h} width={28} height={h} rx={6} fill={i === 4 ? theme.base0B : theme.base0D} opacity={i === 4 ? 1 : 0.75} animation={motion({ scale: 0 }).at(0.4 + i * 0.25).to({ scale: 1 }, 0.7, ease.out)} />
      ))}
      </g>
      {skeleton(24, 238, [250])}
    </>,
  );
}
