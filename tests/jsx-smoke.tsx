import { g, rect, serialize, text, type SvgNode } from "svg-motion";

const Badge = ({ label }: { label: string }): SvgNode => (
  <g>
    <rect x={0} y={0} width={40} height={16} rx={8} fill="#000" />
    <text x={8} y={12} class="ui">
      {label}
    </text>
  </g>
);

const scene = (
  <g aria-label="smoke">
    <rect x={1} y={2} width={3} height={4} />
    <Badge label="hello" />
    <text x={10} y={20}>
      Plain <tspan fill="#f00">red</tspan>
    </text>
  </g>
);

console.log(serialize(scene));
