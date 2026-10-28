// Builds the playground into site/public: /play, and /playground/{embed,app,worker}-<hash>.js for embedding.
// Each file is named by its content and names the next one in the chain, worker <- app <- embed, and the pages point at
// the hashed embed, so a browser never pairs a new page with a cached old worker.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const here = (path: string) => new URL(path, import.meta.url).pathname;
const out = here("../public/playground");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/** Builds one entry with the given constants and returns its file name. */
const bundle = async (entry: string, define: Record<string, string> = {}) => {
  const result = await Bun.build({
    entrypoints: [here(entry)],
    outdir: out,
    target: "browser",
    format: "esm",
    minify: true,
    naming: "[name]-[hash].[ext]",
    define: Object.fromEntries(Object.entries(define).map(([key, value]) => [key, JSON.stringify(value)])),
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  const output = result.outputs[0]!;
  const text = await output.text();
  const name = output.path.split("/").pop()!;
  console.log(`${name.padEnd(24)} ${String(text.length).padStart(7)} B  ${String(gzipSync(text).length).padStart(7)} B gzip`);
  return name;
};

const worker = await bundle("worker.ts");
const app = await bundle("app.ts", { WORKER_FILE: worker });
const embed = await bundle("embed.ts", { APP_FILE: app });

copyFileSync(here("play.html"), here("../public/play.html"));
for (const page of ["../public/play.html", "../public/index.html"]) {
  const html = readFileSync(here(page), "utf8");
  if (!html.includes("/playground/embed.js")) throw new Error(`${page} does not load /playground/embed.js`);
  writeFileSync(here(page), html.replaceAll("/playground/embed.js", `/playground/${embed}`));
}
