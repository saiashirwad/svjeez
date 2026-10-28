// The examples gallery: one page of cards, and one page per example, built from the committed dist/ SVGs.
// A card shows a poster until you hover it, so the gallery stays small however many scenes it lists.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderFrames } from "../src/frames.ts";
import { close, encode } from "./image.ts";

const here = (path: string) => new URL(path, import.meta.url);
const REPO = "https://github.com/saiashirwad/svjeez";
const POSTER_WIDTH = 480;

const SECTIONS = [
  {
    title: "Scenes",
    blurb: "Complete animated scenes, each in a single SVG.",
    names: ["map", "newspaper", "horizon", "lighthouse", "grove", "manifold", "minecraft", "breaker", "reflect", "bloom", "explainer", "walkthrough"],
  },
  {
    title: "Building blocks",
    blurb: "Explore diagrams, terminals, fonts, images, and effects.",
    names: ["flowchart", "sequence", "state", "tree", "lanes", "flows", "terminal", "effects", "fonts", "images", "daynight"],
  },
] as const;

type Example = { name: string; title: string; desc: string; width: number; height: number };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unescape = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const read = (name: string): Example => {
  const svg = readFileSync(here(`../dist/${name}.svg`), "utf8");
  const [, , , width, height] = svg.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/)!.map(Number);
  const title = unescape(svg.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? name);
  const desc = unescape(svg.match(/<desc[^>]*>([^<]*)<\/desc>/)?.[1] ?? "");
  return { name, title, desc, width: width!, height: height! };
};

/** The base of a poster path: `-light.webp` and `-dark.webp` follow it. */
const poster = (ex: Example) => `/examples/poster/${ex.name}`;
const posterHeight = (ex: Example) => Math.round((POSTER_WIDTH * ex.height) / ex.width);

const GITHUB = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;

const HEADER = `<header class="wrap top">
  <a class="brand" href="/">svjeez</a>
  <nav aria-label="Main">
    <a href="/examples/">Examples</a>
    <a href="/intro">Intro</a>
    <a href="${REPO}">GitHub</a>
    <button class="theme" type="button" aria-label="Switch between light and dark">
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>
    </button>
  </nav>
</header>`;

const HEAD = (title: string, description: string, extra = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="https://svjeez.texoport.in/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="/site.css">
<script src="/site.js" defer></script>
${extra}</head>`;

/** Fetch an example's page when the pointer rests on its link. The page is tiny; its SVG loads once you are there. */
const speculate = `<script type="speculationrules">${JSON.stringify({ prefetch: [{ source: "document", where: { href_matches: "/examples/*" }, eagerness: "moderate" }] })}</script>\n`;

const card = (ex: Example) => `
    <a class="card" href="/examples/${ex.name}">
      <span class="shot" data-live="/examples/svg/${ex.name}.svg" data-still="${poster(ex)}"><img data-src="1" width="${POSTER_WIDTH}" height="${posterHeight(ex)}" alt="" decoding="async"></span>
      <span><b>${escape(ex.title)}</b><span class="d">${escape(ex.desc)}</span></span>
    </a>`;

const gallery = (sections: readonly { title: string; blurb: string; examples: Example[] }[]) => `${HEAD("Examples · svjeez", "Explore animated scenes and building blocks made with svjeez. Each is a self-contained SVG.", speculate)}
<body class="gallery">
${HEADER}
<main class="wrap">
  <div class="page-head">
    <p class="kicker">Examples</p>
    <h1>Explore what you can make.</h1>
    <p class="sub">Each example is a single animated SVG made with svjeez. Hover over a card to play it; on touch screens, scenes play as you scroll. Open one to see it full size and find its source.</p>
  </div>
${sections
  .map(
    (section) => `  <section>
    <h2>${section.title}<small>${section.blurb}</small></h2>
    <div class="grid">${section.examples.map(card).join("")}
    </div>
  </section>`,
  )
  .join("\n")}
</main>
<footer class="wrap foot">
  <span>Find the source for every scene on GitHub.</span>
  <nav aria-label="Footer"><a href="${REPO}/tree/main/examples">All sources</a><a href="/">Home</a></nav>
</footer>
</body>
</html>
`;

const viewer = (ex: Example, i: number, all: readonly Example[]) => {
  const prev = all[(i - 1 + all.length) % all.length]!;
  const next = all[(i + 1) % all.length]!;
  return `${HEAD(`${ex.title} · svjeez`, ex.desc || `${ex.title}, made with svjeez`)}
<body class="viewer">
${HEADER}
<main class="wrap">
  <p class="count"><a href="/examples/">← Examples</a> · ${i + 1} of ${all.length}</p>
  <figure class="plate" style="--ratio: ${(ex.width / ex.height).toFixed(4)}; --poster: url(${poster(ex)}-light.webp); margin-block-start: 0.75rem">
    <picture><source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="${poster(ex)}-dark.webp"><source media="(prefers-reduced-motion: reduce)" srcset="${poster(ex)}-light.webp"><img src="/examples/svg/${ex.name}.svg" width="${ex.width}" height="${ex.height}" alt="${escape(ex.desc || ex.title)}"></picture>
  </figure>
  <div class="meta">
    <div>
      <h1>${escape(ex.title)}</h1>
      <p>${escape(ex.desc)}</p>
    </div>
    <div class="actions">
      <a class="btn" href="/examples/${prev.name}" title="${escape(prev.title)}">← Prev</a>
      <a class="btn" href="/examples/${next.name}" title="${escape(next.title)}">Next →</a>
      <a class="btn primary" href="${REPO}/tree/main/examples/${ex.name}">${GITHUB}View the TSX</a>
    </div>
  </div>
</main>
<footer class="wrap foot"><span>One animated SVG, no runtime JavaScript.</span><nav aria-label="Footer"><a href="${REPO}">GitHub</a><a href="/">Home</a></nav></footer>
</body>
</html>
`;
};

/** A settled frame of each scene in each color scheme, at the width a card draws it, as WebP. */
const writePoster = async (ex: Example, out: URL) => {
  const svg = readFileSync(here(`../dist/${ex.name}.svg`), "utf8");
  const scale = POSTER_WIDTH / ex.width;
  const { duration } = await renderFrames(svg, { times: [0], colorScheme: "light" });
  for (const scheme of ["light", "dark"] as const) {
    const { frames } = await renderFrames(svg, { times: [duration * 0.72], colorScheme: scheme, scale });
    writeFileSync(new URL(`${ex.name}-${scheme}.webp`, out), await encode(frames[0]!.png, "webp", 0.7));
  }
};

const out = here("public/examples/");
mkdirSync(new URL("svg/", out), { recursive: true });
mkdirSync(new URL("poster/", out), { recursive: true });
const sections = SECTIONS.map((section) => ({ ...section, examples: section.names.map(read) }));
const all = sections.flatMap((section) => section.examples);
for (const [i, ex] of all.entries()) {
  copyFileSync(here(`../dist/${ex.name}.svg`), new URL(`svg/${ex.name}.svg`, out));
  writeFileSync(new URL(`${ex.name}.html`, out), viewer(ex, i, all));
  await writePoster(ex, new URL("poster/", out));
}
writeFileSync(new URL("index.html", out), gallery(sections));
// The file names carry no hash, so browsers must revalidate every asset or they keep the last deploy's CSS and scenes.
writeFileSync(
  here("public/_headers"),
  ["/examples/svg/*", "/examples/poster/*", "/s/*", "/*.svg", "/*.css", "/*.js"].map((path) => `${path}\n  Cache-Control: public, no-cache`).join("\n") + "\n",
);
await close();
