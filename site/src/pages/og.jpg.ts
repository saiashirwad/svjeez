// The link-preview card: a dark card with the headline on the left and two finished scenes stacked on the right,
// running off the edge as if the page continues.
import type { APIRoute } from "astro";
import { getScene } from "@svjeez/astro/scene";
import { renderFrames } from "svjeez/frames";
import chart from "@examples/site/charts-lines.tsx";
import fourier from "@examples/site/math-fourier.tsx";
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
  const [back, front] = await Promise.all([still(fourier), still(chart)]);
  const icon = await renderFrames(mark, { times: [0], colorScheme: "light", background: "transparent" });

  // Scenes are 504 by 340; both draw at 1.12x.
  const w = 564;
  const h = 381;

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
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#0B0B0F"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#warm)"/>

  <image href="data:image/png;base64,${base64(icon.frames[0]!.png)}" x="72" y="64" width="44" height="44"/>
  <text x="128" y="97" font-family="${SANS}" font-size="30" font-weight="700" letter-spacing="-0.8" fill="#F5F5F7">svjeez</text>

  <text font-family="${SANS}" font-size="68" font-weight="700" letter-spacing="-2.8" fill="#F5F5F7">
    <tspan x="72" y="272">Animated SVGs</tspan>
    <tspan x="72" y="346">from TypeScript.</tspan>
  </text>
  <text font-family="${SANS}" font-size="24" fill="#8E8E96">
    <tspan x="72" y="410">One self-contained file. No runtime</tspan>
    <tspan x="72" y="442">JavaScript. Plays in an img tag.</tspan>
  </text>

  <rect x="72.5" y="516.5" width="196" height="47" rx="23.5" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.14"/>
  <text x="96" y="547" font-family="${MONO}" font-size="19" fill="#F5F5F7"><tspan fill="#6E6E78">$ </tspan>npm i svjeez</text>

  <g filter="url(#shadow)">
    <image href="data:image/png;base64,${back}" x="${1200 - w + 150}" y="58" width="${w}" height="${h}" opacity="0.9"/>
  </g>
  <g filter="url(#shadow)">
    <image href="data:image/png;base64,${front}" x="${1200 - w - 24}" y="294" width="${w}" height="${h}"/>
  </g>
</svg>`;

  const og = await renderFrames(card, { times: [0], colorScheme: "dark" });
  const jpeg = await encode(og.frames[0]!.png, "jpeg", 0.9);
  await close();

  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } });
};
