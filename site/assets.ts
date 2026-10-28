// Social and icon images for the site, rendered from the same SVGs the page serves.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderFrames } from "../src/frames.ts";

const here = (path: string) => new URL(path, import.meta.url);

/** A JPEG, through macOS `sips`. Elsewhere the PNG is written as is. Social cards stay near 100 KB either way. */
const writeJpeg = (png: Uint8Array, to: URL, quality = 82) => {
  const temp = join(tmpdir(), `svjeez-${to.pathname.split("/").pop()}.png`);
  writeFileSync(temp, png);
  const converted = Bun.spawnSync(["sips", "-s", "format", "jpeg", "-s", "formatOptions", String(quality), temp, "--out", to.pathname]);
  if (converted.exitCode !== 0) writeFileSync(to, png);
};

// The card: the headline over a settled frame of the hero scene.
const hero = await renderFrames(readFileSync(here("../dist/landing.svg"), "utf8"), { times: [12], colorScheme: "light", scale: 1.5 });
const still = Buffer.from(hero.frames[0]!.png).toString("base64");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FBF1DE"/>
  <text x="60" y="118" font-family="ui-serif, Georgia, serif" font-size="78" font-weight="700" letter-spacing="-2" fill="#221D14">TSX in. <tspan fill="#E8772E" font-style="italic">One SVG</tspan> out.</text>
  <text x="62" y="170" font-family="ui-sans-serif, system-ui, sans-serif" font-size="27" fill="#6E6450">Motion becomes CSS keyframes. No JavaScript. Plays in an img tag.</text>
  <clipPath id="r"><rect x="60" y="214" width="1080" height="378" rx="18"/></clipPath>
  <image href="data:image/png;base64,${still}" x="60" y="214" width="1080" height="378" clip-path="url(#r)"/>
  <rect x="60.5" y="214.5" width="1079" height="377" rx="18" fill="none" stroke="#E6D9BF"/>
</svg>`;
const og = await renderFrames(card, { times: [0], colorScheme: "light" });
writeJpeg(og.frames[0]!.png, here("public/og.jpg"));

const icon = await renderFrames(readFileSync(here("favicon.svg"), "utf8"), { times: [0], colorScheme: "light" });
writeFileSync(here("public/apple-touch-icon.png"), icon.frames[0]!.png);
