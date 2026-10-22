import { anim, revealWindow, type SvgNode } from "svg-motion";
import { presenceAnimation } from "./motion";
import { C } from "./theme";
import { mono, ui } from "./ui";
import { NoteTree } from "./tree";
import { Margin } from "./margin";

export function AppWindow(): SvgNode {
  return (
    <g animation={anim("window", revealWindow({
      in: [0.1, 0.68],
      out: [25.84, 25.98],
      from: { opacity: 0, y: 10 },
      to: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 0 },
    }))}>
      <g filter="url(#shadow)">
        <rect x={356} y={92} width={796} height={612} rx={16} fill={C.panel} />
      </g>
      <rect x={356.5} y={92.5} width={795} height={611} rx={15.5} fill="url(#panelWash)" stroke={C.line} />
      <path d="M372 92H1136A16 16 0 0 1 1152 108V144H356V108A16 16 0 0 1 372 92Z" fill="url(#cardTop)" />
      <line x1={356} y1={144} x2={1152} y2={144} stroke={C.line} />
      <line x1={372} y1={93} x2={1136} y2={93} stroke={C.rule} strokeOpacity=".07" />

      <circle cx={380} cy={118} r={3.4} fill={C.lineSoft} />
      <circle cx={394} cy={118} r={3.4} fill={C.lineSoft} />
      <circle cx={408} cy={118} r={3.4} fill={C.lineSoft} />
      <text x={432} y={122} {...mono(10.5, C.dim)}>
        Field notes <tspan fill="#3D372E">/</tspan> <tspan fill={C.noteInk}>Retention</tspan>
      </text>

      {[C.sage, C.lavender, C.blue].map((color, index) => (
        <circle
          key={`presence-${index}`}
          cx={1002 + index * 12}
          cy={118}
          r={3}
          fill={color}
          animation={presenceAnimation(index)}
        />
      ))}
      <text x={1120} y={121} {...mono(8.5, C.faint, { letterSpacing: 1.4, textAnchor: "end" })}>3 AGENTS</text>

      <g animation={anim("note", revealWindow({
        in: [0.26, 0.73],
        out: [25.79, 25.95],
        from: { opacity: 0, y: 6 },
        to: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }))}>
        <text x={396} y={176} class="ser" fontSize={28} fill={C.ink}>Retention is a supply problem</text>
        <text x={396} y={198} {...mono(9.5, C.dim)}>Field notes · updated just now</text>

        <g animation={anim("conflict-badge", revealWindow({
          in: [20.64, 20.9],
          from: { opacity: 0, y: 2 },
          to: { opacity: 1, y: 0 },
        }))}>
          <rect x={1020} y={158} width={84} height={16} rx={8} fill={C.coral} fillOpacity=".1" stroke={C.coral} strokeOpacity=".35" />
          <circle cx={1030} cy={166} r={2.3} fill={C.coral} />
          <text x={1037} y={169.5} {...mono(7.5, C.coral, { letterSpacing: 0.9 })}>1 CONFLICT</text>
        </g>

        <line x1={396} y1={212} x2={1120} y2={212} stroke={C.rule} strokeOpacity=".08" />

        <g clipPath="url(#noteClip)">
          <NoteTree />
          <Margin />
        </g>
      </g>

      <rect x={356.5} y={92.5} width={795} height={611} rx={15.5} fill="none" stroke={C.line} />
    </g>
  );
}
