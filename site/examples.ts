// The examples gallery: one page of cards, and one full-screen page per example, built from the committed dist/ SVGs.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const here = (path: string) => new URL(path, import.meta.url);
const REPO = "https://github.com/saiashirwad/svjeez";

const SECTIONS = [
  {
    title: "scenes",
    blurb: "whole little films, each one a single SVG file",
    names: ["map", "newspaper", "horizon", "lighthouse", "grove", "manifold", "minecraft", "breaker", "reflect", "bloom", "explainer", "walkthrough"],
  },
  {
    title: "building blocks",
    blurb: "typed diagrams, terminals, fonts and effects to make them from",
    names: ["flowchart", "sequence", "state", "tree", "lanes", "flows", "terminal", "effects", "fonts", "images"],
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

const HEAD = (title: string, description: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="https://svjeez.texoport.in/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/examples/style.css">
</head>`;

const SHADOWS = ["var(--pink)", "var(--blue)", "var(--sun)"];

const card = (ex: Example, i: number) => `
    <a class="card" href="/examples/${ex.name}" style="--shadow: ${SHADOWS[i % 3]}; --tilt: ${[-1.2, 0.8, -0.4, 1.4][i % 4]}deg">
      <span class="frame" style="aspect-ratio: ${ex.width} / ${ex.height}"><img src="/examples/svg/${ex.name}.svg" alt="" loading="lazy" decoding="async"></span>
      <span class="name">${escape(ex.title)}</span>
      <span class="desc">${escape(ex.desc)}</span>
    </a>`;

const gallery = (sections: readonly { title: string; blurb: string; examples: Example[] }[]) => `${HEAD("svjeez · examples", "Scenes and building blocks made with svjeez. Every one is a single animated SVG with no JavaScript.")}
<body class="gallery">
<header>
  <a class="pill" href="/">← home</a>
  <h1><span>examples</span></h1>
  <p>every one of these is a single SVG file, written in TSX.<br>no JavaScript, no video, no runtime. <span class="hand">just svjeez.</span></p>
</header>
${sections
  .map(
    (section, s) => `<section>
  <h2>${section.title} <small>${section.blurb}</small></h2>
  <div class="grid">${section.examples.map((ex, i) => card(ex, i + s)).join("")}
  </div>
</section>`,
  )
  .join("\n")}
<footer><a class="pill" href="${REPO}">see them all on GitHub</a></footer>
</body>
</html>
`;

const viewer = (ex: Example) => `${HEAD(`${ex.title} · svjeez`, ex.desc || `${ex.title}, made with svjeez`)}
<body class="viewer">
<img src="/examples/svg/${ex.name}.svg" alt="${escape(ex.desc || ex.title)}">
<nav>
  <a class="pill" href="/examples">← examples</a>
  <span class="title">${escape(ex.title)}</span>
  <a class="pill alt icon" href="${REPO}/tree/main/examples/${ex.name}" aria-label="View the TSX on GitHub" title="View the TSX on GitHub"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg></a>
</nav>
</body>
</html>
`;

const out = here("public/examples/");
mkdirSync(new URL("svg/", out), { recursive: true });
const sections = SECTIONS.map((section) => ({ ...section, examples: section.names.map(read) }));
for (const ex of sections.flatMap((section) => section.examples)) {
  copyFileSync(here(`../dist/${ex.name}.svg`), new URL(`svg/${ex.name}.svg`, out));
  writeFileSync(new URL(`${ex.name}.html`, out), viewer(ex));
}
writeFileSync(new URL("index.html", out), gallery(sections));
copyFileSync(here("examples.css"), new URL("style.css", out));
