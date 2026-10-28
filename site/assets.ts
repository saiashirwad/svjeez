// Social and icon images for the site, rendered from the same SVGs the page serves.
import { readFileSync, writeFileSync } from "node:fs";
import { renderFrames } from "../src/frames.ts";
import { close, encode } from "./image.ts";

const here = (path: string) => new URL(path, import.meta.url);
const png = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const hero = readFileSync(here("public/s/hero.svg"), "utf8");
const held = Number(hero.match(/animation-delay:-([\d.]+)s!important/)?.[1] ?? 12);
const window = await renderFrames(hero, { times: [held], colorScheme: "light", scale: 1.5, background: "transparent" });
const mark = await renderFrames(readFileSync(here("favicon.svg"), "utf8"), { times: [0], colorScheme: "light", scale: 1, background: "transparent" });

// The card: the product window under the headline, cropped by the bottom edge like a screenshot.
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <image href="data:image/png;base64,${png(mark.frames[0]!.png)}" x="84" y="64" width="64" height="64"/>
  <text x="168" y="108" font-family="-apple-system, 'SF Pro Display', system-ui, sans-serif" font-size="46" font-weight="700" letter-spacing="-1.5" fill="#1D1D1F">svjeez</text>
  <text x="84" y="192" font-family="-apple-system, 'SF Pro Display', system-ui, sans-serif" font-size="30" fill="#6E6E73">TSX in, one animated SVG out. No JavaScript, plays in an img tag.</text>
  <clipPath id="r"><rect x="84" y="252" width="1032" height="420" rx="14"/></clipPath>
  <image href="data:image/png;base64,${png(window.frames[0]!.png)}" x="84" y="252" width="1032" height="640" clip-path="url(#r)"/>
  <rect x="84.5" y="252.5" width="1031" height="420" rx="14" fill="none" stroke="#000" stroke-opacity="0.08"/>
</svg>`;
const og = await renderFrames(card, { times: [0], colorScheme: "light" });
writeFileSync(here("public/og.jpg"), await encode(og.frames[0]!.png, "jpeg", 0.85));

const icon = await renderFrames(readFileSync(here("favicon.svg"), "utf8"), { times: [0], colorScheme: "light", scale: 180 / 208 });
writeFileSync(here("public/apple-touch-icon.png"), icon.frames[0]!.png);
await close();
