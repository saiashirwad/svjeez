import type { SvgNode } from "svg-motion";

export function Defs(): SvgNode {
  return (
    <>
      <linearGradient id="bg" x1={0} y1={0} x2={1} y2={1}>
        <stop offset={0} stopColor="#0B0907" />
        <stop offset=".55" stopColor="#080706" />
        <stop offset={1} stopColor="#0C0A08" />
      </linearGradient>
      <radialGradient id="warm" cx=".82" cy=".04" r=".7">
        <stop offset={0} stopColor="#D6A96D" stopOpacity=".07" />
        <stop offset=".55" stopColor="#D6A96D" stopOpacity=".018" />
        <stop offset={1} stopColor="#D6A96D" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cool" cx=".02" cy=".96" r=".55">
        <stop offset={0} stopColor="#8EA3B8" stopOpacity=".035" />
        <stop offset={1} stopColor="#8EA3B8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="vignette" cx=".5" cy=".44" r=".78">
        <stop offset=".55" stopColor="#000" stopOpacity="0" />
        <stop offset={1} stopColor="#000" stopOpacity=".38" />
      </radialGradient>
      <linearGradient id="cardTop" x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor="#17130F" />
        <stop offset={1} stopColor="#14110D" />
      </linearGradient>
      <linearGradient id="panelWash" x1={0} y1={0} x2={1} y2={1}>
        <stop offset={0} stopColor="#D6A96D" stopOpacity=".022" />
        <stop offset=".5" stopColor="#D6A96D" stopOpacity="0" />
      </linearGradient>
      <pattern id="grid" width={48} height={48} patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="#EDE6D8" strokeOpacity=".018" />
      </pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx={0} dy={22} stdDeviation={30} floodColor="#000" floodOpacity=".52" />
      </filter>
      <filter id="float" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx={0} dy={10} stdDeviation={13} floodColor="#000" floodOpacity=".38" />
      </filter>
      <clipPath id="cardClip">
        <rect width={1200} height={760} rx={24} />
      </clipPath>
      <clipPath id="noteClip">
        <rect x={372} y={212} width={764} height={480} />
      </clipPath>
    </>
  );
}
