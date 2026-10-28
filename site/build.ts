// Builds site/public: the pages, the scenes they use, and a still poster of each scene in both color schemes.
// The scenes are discovered from `data-scene="..."` in index.html, so the page is the single list.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { renderFrames } from "../src/frames.ts";
import { encode, close } from "./image.ts";

const here = (path: string) => new URL(path, import.meta.url);
const ROOT = here("../").pathname;
const PUBLIC = here("public/").pathname;

const highlight = (source: string) => {
  const keywords = new Set(["import", "from", "export", "default", "const", "return"]);
  const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const token = /(\/\/.*)|("[^"]*")|(\b\d+(?:\.\d+)?\b)|(<\/?[A-Za-z][\w.]*|<\/?>|\/>)|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)|(.)/gs;
  return source.replace(token, (m, comment, string, number, tag, fn, word) => {
    const cls = comment ? "c" : string ? "s" : number ? "n" : tag ? "f" : fn ? "f" : word && keywords.has(word) ? "k" : "";
    return cls ? `<span class="${cls}">${escape(m)}</span>` : escape(m);
  });
};
const toast = highlight(readFileSync(`${ROOT}examples/site/toast.tsx`, "utf8").trimEnd());
const html = readFileSync(here("index.html"), "utf8").replace("{{TOAST_CODE}}", toast);
const names = [...new Set([...html.matchAll(/data-scene="([\w-]+)"/g)].map((m) => m[1]!))];
const dist = (name: string) => (name === "daynight" ? "daynight" : `site/${name}`);

const built = Bun.spawnSync(["bun", "run", "build", "hype", ...names.map(dist)], { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
if (built.exitCode !== 0) process.exit(built.exitCode);

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(`${PUBLIC}s/poster`, { recursive: true });
for (const file of ["intro.html", "site.css", "site.js", "favicon.svg"]) copyFileSync(here(file), new URL(file, here("public/")));
copyFileSync(`${ROOT}dist/hype.svg`, `${PUBLIC}hype.svg`);

/** The frame the scene itself would hold under prefers-reduced-motion, else most of the way through. */
const stillAt = (svg: string, duration: number) => {
  const held = svg.match(/animation-delay:-([\d.]+)s!important/);
  return held ? Number(held[1]) : duration * 0.72;
};

let gzipped = 0;
for (const name of names) {
  const svg = readFileSync(`${ROOT}dist/${dist(name)}.svg`, "utf8");
  writeFileSync(`${PUBLIC}s/${name}.svg`, svg);
  gzipped += Bun.gzipSync(svg).length;
  const width = Number(svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/)![1]);
  const { duration } = await renderFrames(svg, { times: [0] });
  for (const scheme of ["light", "dark"] as const) {
    const { frames } = await renderFrames(svg, { times: [stillAt(svg, duration)], colorScheme: scheme, scale: width > 700 ? 1 : 1.5, background: "transparent" });
    writeFileSync(`${PUBLIC}s/poster/${name}-${scheme}.webp`, await encode(frames[0]!.png, "webp", 0.8));
  }
}
console.log(`${names.length} scenes, ${(gzipped / 1024).toFixed(1)} KB gzipped in all`);
writeFileSync(`${PUBLIC}index.html`, html.replace("{{TOTAL_KB}}", String(Math.round(gzipped / 1024))));
await close();
