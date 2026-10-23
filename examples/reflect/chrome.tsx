import { def, el, type SvgNode } from "svg-motion";
import { C, H, W, ui } from "./theme";

const aura = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 720, cy: 239, r: 736, gradientTransform: "translate(720 239) scale(0.74 1) translate(-720 -239)" }, (
  <>
    <stop offset={0} stopColor="#9465FF" stopOpacity={0.08} />
    <stop offset={1} stopColor="#9465FF" stopOpacity={0} />
  </>
));

const hairline = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#FFF" stopOpacity={0} />
    <stop offset={0.5} stopColor="#FFF" stopOpacity={0.12} />
    <stop offset={1} stopColor="#FFF" stopOpacity={0} />
  </>
));

const tile = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#7A5CFF" />
    <stop offset={1} stopColor="#2A1785" />
  </>
));

const headline = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#FFF" />
    <stop offset={1} stopColor="#FFF" stopOpacity={0.7} />
  </>
));

const prism = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#EFC4FF" />
    <stop offset={0.5} stopColor="#D6C4FF" />
    <stop offset={1} stopColor="#C4D1FF" />
  </>
));

const prismEdge = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#E59CFF" stopOpacity={0.24} />
    <stop offset={0.5} stopColor="#BA9CFF" stopOpacity={0.24} />
    <stop offset={1} stopColor="#9CB2FF" stopOpacity={0.24} />
  </>
));

const badgeGlow = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0.4} stopColor="#A48FFF" stopOpacity={0} />
    <stop offset={1} stopColor="#A48FFF" stopOpacity={0.16} />
  </>
));

const primaryFill = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#3A1C7A" stopOpacity={0.45} />
    <stop offset={1} stopColor="#3C087E" stopOpacity={0.75} />
  </>
));

const primaryEdge = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.lilac} stopOpacity={0.56} />
    <stop offset={1} stopColor={C.lilac} stopOpacity={0.32} />
  </>
));

const secondaryFill = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#F3EEFF" stopOpacity={0.01} />
    <stop offset={1} stopColor="#F3EEFF" stopOpacity={0.05} />
  </>
));

export function Backdrop(): SvgNode {
  return (
    <>
      <rect width={W} height={H} fill={C.bg} />
      <rect width={W} height={900} fill={aura} />
    </>
  );
}

function Logo(): SvgNode {
  return (
    <g transform="translate(90 44)" fill="none" stroke="#FFF" strokeWidth={1.1} strokeLinecap="round">
      <rect x={-17.5} y={-17.5} width={35} height={35} rx={8} fill={tile} stroke="#FFF" strokeOpacity={0.18} />
      <circle r={10.5} strokeOpacity={0.9} />
      <ellipse rx={10.5} ry={4.2} strokeOpacity={0.55} transform="rotate(-28)" />
      <ellipse rx={4.6} ry={10.5} strokeOpacity={0.55} transform="rotate(-28)" />
      <path d="M-7 -6L3 -8L8 2L-1 8L-8 3Z" strokeOpacity={0.75} />
      {[[-7, -6], [3, -8], [8, 2], [-1, 8], [-8, 3]].map(([x, y]) =>
        el.circle({ cx: x, cy: y, r: 1.4, fill: "#FFF", stroke: "none" }),
      )}
    </g>
  );
}

const NAV = [
  ["Product", 532],
  ["Pricing", 605],
  ["Company", 683],
  ["Blog", 753],
  ["Changelog", 827],
  ["GitHub", 910],
] as const;

export function Header(): SvgNode {
  return (
    <g>
      <Logo />
      <text x={120} y={49.5} {...ui(16, C.ink, { fontWeight: 500 })}>Reflect</text>

      <rect x={482.5} y={23.5} width={475} height={41} rx={20.5} fill="#FFF" fillOpacity={0.02} stroke="#FFF" strokeOpacity={0.08} />
      {NAV.map(([label, x]) =>
        el.text({ x, y: 49, ...ui(14, "#FFFFFF", { fillOpacity: 0.9, textAnchor: "middle" }) }, label),
      )}

      <text x={1245} y={49} {...ui(14, "#FFFFFF", { fontWeight: 500, textAnchor: "end" })}>Log in to Classic</text>
      <Button kind="primary" x={1269} y={26} width={98} label="Download" />

      <rect x={112} y={87.5} width={1216} height={1} fill={hairline} />
    </g>
  );
}

function Button(props: { kind: "primary" | "secondary"; x: number; y: number; width: number; label: string }): SvgNode {
  const { kind, x, y, width, label } = props;
  const primary = kind === "primary";
  return el.g({}, [
    el.rect({ x, y, width, height: 36, rx: 8, fill: primary ? "#712FFF" : "#9382FF", fillOpacity: primary ? 0.12 : 0.01 }),
    el.rect({ x, y, width, height: 36, rx: 8, fill: primary ? primaryFill : secondaryFill }),
    el.rect({
      x: x + 0.5,
      y: y + 0.5,
      width: width - 1,
      height: 35,
      rx: 7.5,
      fill: "none",
      stroke: primary ? primaryEdge : "#F3EEFF",
      strokeOpacity: primary ? 1 : 0.1,
    }),
    el.text({ x: x + width / 2, y: y + 23, ...ui(14, C.ink, { fontWeight: 500, textAnchor: "middle" }) }, label),
  ]);
}

const SPARKLES = [
  "M9 6.5C9 6.33 8.86 6.19 8.69 6.19C7.65 6.19 6.81 5.35 6.81 4.31C6.81 4.14 6.67 4 6.5 4C6.33 4 6.19 4.14 6.19 4.31C6.19 5.35 5.35 6.19 4.31 6.19C4.14 6.19 4 6.33 4 6.5C4 6.67 4.14 6.81 4.31 6.81C5.35 6.81 6.19 7.65 6.19 8.69C6.19 8.86 6.33 9 6.5 9C6.67 9 6.81 8.86 6.81 8.69C6.81 7.65 7.65 6.81 8.69 6.81C8.86 6.81 9 6.67 9 6.5Z",
  "M16.5 6C16.5 5.72 16.28 5.5 16 5.5C15.72 5.5 15.5 5.72 15.5 6C15.5 8.48 13.49 10.5 11 10.5C10.72 10.5 10.5 10.72 10.5 11C10.5 11.28 10.72 11.5 11 11.5C13.49 11.5 15.5 13.51 15.5 16C15.5 16.28 15.72 16.5 16 16.5C16.28 16.5 16.5 16.28 16.5 16C16.5 13.51 18.51 11.5 21 11.5C21.28 11.5 21.5 11.28 21.5 11C21.5 10.72 21.28 10.5 21 10.5C18.51 10.5 16.5 8.48 16.5 6Z",
  "M7.5 12.5C7.5 12.22 7.28 12 7 12C6.72 12 6.5 12.22 6.5 12.5C6.5 14.16 5.16 15.5 3.5 15.5C3.22 15.5 3 15.72 3 16C3 16.28 3.22 16.5 3.5 16.5C5.16 16.5 6.5 17.84 6.5 19.5C6.5 19.78 6.72 20 7 20C7.28 20 7.5 19.78 7.5 19.5C7.5 17.84 8.84 16.5 10.5 16.5C10.78 16.5 11 16.28 11 16C11 15.72 10.78 15.5 10.5 15.5C8.84 15.5 7.5 14.16 7.5 12.5Z",
];

const sparkleFill = def.linearGradient({ gradientUnits: "userSpaceOnUse", x1: 3, y1: 0, x2: 21.5, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#EFC4FF" />
    <stop offset={0.5} stopColor="#D6C4FF" />
    <stop offset={1} stopColor="#C4D1FF" />
  </>
));

function Badge(): SvgNode {
  return (
    <g>
      <rect x={633} y={173} width={174} height={32} rx={16} fill={badgeGlow} />
      <rect x={633.5} y={173.5} width={173} height={31} rx={15.5} fill="none" stroke={prismEdge} />
      <g transform="translate(641 177)">
        {SPARKLES.map((d) =>
          el.path({ d, fill: sparkleFill }),
        )}
      </g>
      <text x={671} y={194} {...ui(14, "#FFFFFF", { fill: prism })}>Meet Reflect Open</text>
    </g>
  );
}

export function Copy(): SvgNode {
  return (
    <g>
      <Badge />
      <text x={720} y={289} class="display" fontSize={72} fill={headline} textAnchor="middle" textLength={798} lengthAdjust="spacing">Think better with Reflect</text>
      <text x={720} y={331} {...ui(18, C.text, { fillOpacity: 0.7, textAnchor: "middle" })}>
        An open-source note-taking app with daily notes, backlinks, and local
      </text>
      <text x={720} y={355} {...ui(18, C.text, { fillOpacity: 0.7, textAnchor: "middle" })}>Markdown files.</text>
      <Button kind="primary" x={534} y={393} width={154} label="Download for Mac" />
      <Button kind="secondary" x={700} y={393} width={206} label="Get the iPhone & iPad app" />
      <text x={720} y={460} {...ui(14, C.text, { fillOpacity: 0.6, textAnchor: "middle" })}>
        Free on Mac. Paid subscription on iPhone and iPad.
      </text>
    </g>
  );
}
