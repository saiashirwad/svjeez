import type { AnimationRequest, ChildInput, NodeProps, SvgNode } from "svg-motion";
import { C } from "./theme";

export const ui = (size: number, fill: string, extra: NodeProps = {}): NodeProps => ({
  class: "ui",
  "font-size": size,
  fill,
  ...extra,
});

export const mono = (size: number, fill: string, extra: NodeProps = {}): NodeProps => ({
  class: "mono",
  "font-size": size,
  fill,
  ...extra,
});

export const serif = (size: number, fill: string, extra: NodeProps = {}): NodeProps => ({
  class: "ser",
  "font-size": size,
  fill,
  ...extra,
});

export interface TreeRowProps {
  animation: AnimationRequest;
  x: number;
  y: number;
  bulletX: number;
  r: number;
  fill: string;
  size?: number;
  color?: string;
  weight?: number;
  children: ChildInput;
}

export function TreeRow(props: TreeRowProps): SvgNode {
  return (
    <g animation={props.animation}>
      <circle cx={props.bulletX} cy={props.y - 5} r={props.r} fill={props.fill} />
      <text
        x={props.x}
        y={props.y}
        {...ui(props.size ?? 14, props.color ?? C.text)}
        font-weight={props.weight}
      >
        {props.children}
      </text>
    </g>
  );
}

export function AgentAvatar(props: {
  cx: number;
  cy: number;
  r: number;
  initial: string;
  color: string;
  size?: number;
}): SvgNode {
  const size = props.size ?? 8;
  return (
    <g>
      <circle cx={props.cx} cy={props.cy} r={props.r} fill={props.color} fill-opacity={0.13} stroke={props.color} stroke-opacity={0.34} />
      <text
        x={props.cx}
        y={props.cy + size * 0.35}
        {...mono(size, props.color, { textAnchor: "middle" })}
      >
        {props.initial}
      </text>
    </g>
  );
}

export function MiniAvatar(props: {
  cx: number;
  cy: number;
  initial: string;
  color: string;
}): SvgNode {
  return (
    <g>
      <circle cx={props.cx} cy={props.cy} r={6.5} fill={props.color} fill-opacity={0.12} stroke={props.color} stroke-opacity={0.32} />
      <text x={props.cx} y={props.cy + 2.5} {...mono(7, props.color, { textAnchor: "middle" })}>
        {props.initial}
      </text>
    </g>
  );
}

export function CardHeader(props: {
  y: number;
  initial: string;
  name: string;
  role: string;
  meta: string;
  color: string;
}): SvgNode {
  const { y, color } = props;
  return (
    <g>
      <AgentAvatar cx={858} cy={y + 26} r={9.5} initial={props.initial} color={color} />
      <text x={874} y={y + 24} {...ui(11.5, C.ink, { fontWeight: 600 })}>{props.name}</text>
      <text x={874} y={y + 35} {...ui(8.5, C.dim)}>{props.role}</text>
      <text x={1104} y={y + 24} {...mono(7.5, C.faint, { textAnchor: "end" })}>{props.meta}</text>
      <line x1={852} y1={y + 44} x2={1104} y2={y + 44} stroke={C.lineSoft} />
    </g>
  );
}

export function CardShell(props: {
  animation: AnimationRequest;
  y: number;
  h: number;
  children: ChildInput;
  stroke?: string;
  x?: number;
  w?: number;
  r?: number;
}): SvgNode {
  return (
    <g animation={props.animation}>
      <rect
        x={props.x ?? 836}
        y={props.y}
        width={props.w ?? 284}
        height={props.h}
        rx={props.r ?? 12}
        fill={C.card}
        stroke={props.stroke ?? C.lineSoft}
        filter="url(#float)"
      />
      {props.children}
    </g>
  );
}

export function Thread(props: {
  d: string;
  endX: number;
  endY: number;
  color: string;
  animation: AnimationRequest;
  strokeOpacity?: number;
}): SvgNode {
  return (
    <>
      <path
        d={props.d}
        pathLength={1}
        stroke={props.color}
        stroke-opacity={props.strokeOpacity ?? 0.38}
        stroke-width={1}
        stroke-dasharray={1}
        fill="none"
        animation={props.animation}
      />
      <circle
        cx={props.endX}
        cy={props.endY}
        r={2.2}
        fill={props.color}
        fill-opacity={0.7}
        animation={props.animation}
      />
    </>
  );
}

export function PulseDots(props: {
  x: number;
  y: number;
  color: string;
  count?: number;
  gap?: number;
  r?: number;
}): SvgNode {
  const count = props.count ?? 3;
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <circle
          cx={props.x + index * (props.gap ?? 7)}
          cy={props.y}
          r={props.r ?? 1.7}
          fill={props.color}
          class="pulse"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </>
  );
}
