import { def } from "svjeez";

export const bg = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#0B0907" />
    <stop offset={0.55} stopColor="#080706" />
    <stop offset={1} stopColor="#0C0A08" />
  </>
));

export const warm = def.radialGradient({ cx: 0.82, cy: 0.04, r: 0.7 }, (
  <>
    <stop offset={0} stopColor="#D6A96D" stopOpacity={0.07} />
    <stop offset={0.55} stopColor="#D6A96D" stopOpacity={0.018} />
    <stop offset={1} stopColor="#D6A96D" stopOpacity={0} />
  </>
));

export const cool = def.radialGradient({ cx: 0.02, cy: 0.96, r: 0.55 }, (
  <>
    <stop offset={0} stopColor="#8EA3B8" stopOpacity={0.035} />
    <stop offset={1} stopColor="#8EA3B8" stopOpacity={0} />
  </>
));

export const vignette = def.radialGradient({ cx: 0.5, cy: 0.44, r: 0.78 }, (
  <>
    <stop offset={0.55} stopColor="#000" stopOpacity={0} />
    <stop offset={1} stopColor="#000" stopOpacity={0.38} />
  </>
));

export const cardTop = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#17130F" />
    <stop offset={1} stopColor="#14110D" />
  </>
));

export const panelWash = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#D6A96D" stopOpacity={0.022} />
    <stop offset={0.5} stopColor="#D6A96D" stopOpacity={0} />
  </>
));

export const grid = def.pattern(
  { width: 48, height: 48, patternUnits: "userSpaceOnUse" },
  <path d="M48 0H0V48" fill="none" stroke="#EDE6D8" strokeOpacity={0.018} />,
);

export const shadow = def.filter(
  { x: "-20%", y: "-20%", width: "140%", height: "150%" },
  <feDropShadow dx={0} dy={22} stdDeviation={30} floodColor="#000" floodOpacity={0.52} />,
);

export const float = def.filter(
  { x: "-30%", y: "-30%", width: "160%", height: "170%" },
  <feDropShadow dx={0} dy={10} stdDeviation={13} floodColor="#000" floodOpacity={0.38} />,
);

export const cardClip = def.clipPath({}, <rect width={1200} height={760} rx={24} />);

export const noteClip = def.clipPath({}, <rect x={372} y={212} width={764} height={480} />);
