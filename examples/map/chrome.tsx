import { Ink, ease, enter, tool, type SvgNode } from "svjeez";
import { C, Words, n, roman, uncial, type Play } from "./kit";

const star = (cx: number, cy: number, r: number, inner: number, turn = 0): string =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + turn - Math.PI / 2;
    const rr = i % 2 ? inner : r;

    return `${i ? "L" : "M"}${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  }).join("") + "Z";

export function Compass({ x, y, play }: { x: number; y: number; play: Play }): SvgNode {
  return (
    <g
      animation={play(
        enter({ at: 0.6, over: 1.4 }, { opacity: 0, rotate: -90, scale: 0.4 }, ease.out),
      )}
    >
      <circle cx={x} cy={y} r={34} fill="none" stroke={C.ink} strokeWidth={0.8} />
      <circle
        cx={x}
        cy={y}
        r={30}
        fill="none"
        stroke={C.ink}
        strokeWidth={0.5}
        strokeDasharray="1.5 3"
      />
      <path d={star(x, y, 26, 4, Math.PI / 4)} fill={C.faded} opacity={0.5} />
      <path
        d={star(x, y, 40, 6)}
        fill={C.land}
        stroke={C.ink}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <path d={`M${x} ${y - 40}L${x + 6} ${y - 6}L${x} ${y}Z`} fill={C.red} />
      <Words face={roman} text="N" size={13} x={x} y={y - 45} anchor="middle" />
    </g>
  );
}

const RULE = tool.brush({ size: 2.4, taper: 0.45, seed: 12 });

export function Cartouche({ play }: { play: Play }): SvgNode {
  const [x, y, w, h] = [26, 24, 300, 92];
  const mid = x + w / 2;

  return (
    <g animation={play(enter({ at: 0.4, over: 0.8 }, { opacity: 0, y: -8 }))}>
      <rect x={x} y={y} width={w} height={h} fill={C.land} stroke={C.ink} strokeWidth={1.4} />
      <rect
        x={x + 5}
        y={y + 5}
        width={w - 10}
        height={h - 10}
        fill="none"
        stroke={C.ink}
        strokeWidth={0.6}
      />
      <Words
        face={uncial}
        text="The Western Reaches"
        size={27}
        x={mid}
        y={y + 50}
        anchor="middle"
      />
      <Ink
        d={`M${x + 60} ${y + 62}h${w - 120}`}
        tool={RULE}
        fill={C.red}
        draw={play({ at: 1, over: 0.8 })}
      />
      <Words
        face={roman}
        text="Being a map of the long road to Mount Cinder"
        size={9}
        x={mid}
        y={y + 78}
        fill={C.faded}
        anchor="middle"
      />
    </g>
  );
}

export function ScaleBar({ x, y, play }: { x: number; y: number; play: Play }): SvgNode {
  const segment = 30;

  return (
    <g animation={play(enter({ at: 0.8, over: 0.6 }))}>
      {[0, 1, 2, 3].map((i) => (
        <rect
          x={x + i * segment}
          y={y}
          width={segment}
          height={5}
          fill={i % 2 ? C.land : C.ink}
          stroke={C.ink}
          strokeWidth={0.8}
        />
      ))}
      {[0, 50, 100].map((v, i) => (
        <Words
          face={roman}
          text={String(v)}
          size={8}
          x={x + i * segment * 2}
          y={y + 16}
          anchor="middle"
        />
      ))}
      <Words face={roman} text="Leagues" size={9} x={x + segment * 2} y={y - 6} anchor="middle" />
    </g>
  );
}
