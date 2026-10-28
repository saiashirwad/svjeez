// Social and icon images for the site, rendered from the same SVGs the page serves.
import { readFileSync, writeFileSync } from "node:fs";
import { renderFrames } from "../src/frames.ts";

const here = (path: string) => new URL(path, import.meta.url);
const OG = { width: 1200, height: 630, at: 2.75 };

// The landing scene is a square shown with `cover`; a 1200×630 slice of it is what a laptop sees.
const landing = readFileSync(here("../dist/landing.svg"), "utf8").replace(
  /<svg ([^>]*?)width="\d+" height="\d+"/,
  `<svg $1width="${OG.width}" height="${OG.height}" preserveAspectRatio="xMidYMid slice"`,
);
const og = await renderFrames(landing, { times: [OG.at], colorScheme: "light" });
writeFileSync(here("public/og.png"), og.frames[0]!.png);

const icon = await renderFrames(readFileSync(here("favicon.svg"), "utf8"), { times: [0], colorScheme: "light" });
writeFileSync(here("public/apple-touch-icon.png"), icon.frames[0]!.png);
