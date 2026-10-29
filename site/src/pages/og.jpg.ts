// The link-preview card: a dark card with the headline on the left and a tilted wall of finished scenes on the right,
// running off the edges as if the page continues.
import type { APIRoute } from "astro";
import { getScene } from "@svjeez/astro/scene";
import { renderFrames } from "svjeez/frames";
import charts from "@examples/site/charts-grouped.tsx";
import fourier from "@examples/site/math-fourier.tsx";
import fonts from "@examples/site/fonts.tsx";
import geo from "@examples/site/geo.tsx";
import icons from "@examples/site/icons.tsx";
import ink from "@examples/site/ink.tsx";
import euler from "@examples/site/math.tsx";
import recording from "@examples/site/recording.tsx";
import team from "@examples/site/team.tsx";
import mark from "../../public/favicon.svg?raw";
import { close, encode } from "@svjeez/vite/encode";

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** A scene's reduced-motion frame, the one it holds as its still, rendered dark. */
const still = async (build: () => string) => {
  const { svg } = getScene(build);
  const held = Number(/animation-delay:-([\d.]+)s!important/.exec(svg)?.[1] ?? 0);
  const { frames } = await renderFrames(svg, { times: [held], colorScheme: "dark", scale: 2, background: "transparent" });

  return base64(frames[0]!.png);
};

const SANS = "-apple-system, 'SF Pro Display', system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

export const GET: APIRoute = async () => {
  // Three staggered columns, top to bottom, so maps, math, type, diagrams and charts all show.
  const columns = [
    [ink, geo, icons],
    [fourier, charts, recording],
    [team, euler, fonts],
  ];
  const stills = await Promise.all(columns.map((column) => Promise.all(column.map(still))));
  const icon = await renderFrames(mark, { times: [0], colorScheme: "light", background: "transparent" });

  // Scenes are 504 by 340, drawn at 0.62x.
  const w = 312;
  const h = 210;
  const gap = 22;
  const wall = stills
    .flatMap((column, c) =>
      column.map(
        (png, r) =>
          `<image href="data:image/png;base64,${png}" x="${c * (w + gap)}" y="${r * (h + gap) + [60, 0, 110][c]!}" width="${w}" height="${h}" filter="url(#shadow)"/>`,
      ),
    )
    .join("\n    ");

  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.82" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#3B4CCA" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#3B4CCA" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="warm" cx="0.05" cy="0.0" r="0.55">
      <stop offset="0" stop-color="#FFC21A" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#FFC21A" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1" fill="#FFFFFF" fill-opacity="0.05"/>
    </pattern>
    <linearGradient id="fade" x1="0" x2="1">
      <stop offset="0.42" stop-color="#0B0B0F"/>
      <stop offset="0.62" stop-color="#0B0B0F" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#0B0B0F"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#warm)"/>

  <g transform="translate(560 -120) rotate(-14 500 400)">
    ${wall}
  </g>
  <rect width="1200" height="630" fill="url(#fade)"/>

  <image href="data:image/png;base64,${base64(icon.frames[0]!.png)}" x="72" y="64" width="44" height="44"/>
  <text x="128" y="97" font-family="${SANS}" font-size="30" font-weight="700" letter-spacing="-0.8" fill="#F5F5F7">svjeez</text>

  <text font-family="${SANS}" font-size="68" font-weight="700" letter-spacing="-2.8" fill="#F5F5F7">
    <tspan x="72" y="272">Animated SVGs</tspan>
    <tspan x="72" y="346">from TypeScript.</tspan>
  </text>
  <text x="73" y="414" font-family="${SANS}" font-size="25" letter-spacing="-0.2" fill="#8E8E96">Animations for the web, with no JavaScript.</text>

  <rect x="72.5" y="466.5" width="196" height="47" rx="23.5" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.14"/>
  <text x="96" y="497" font-family="${MONO}" font-size="19" fill="#F5F5F7"><tspan fill="#6E6E78">$ </tspan>npm i svjeez</text>

</svg>`;

  const og = await renderFrames(card, { times: [0], colorScheme: "dark" });
  const jpeg = await encode(og.frames[0]!.png, "jpeg", 0.9);
  await close();

  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
};
