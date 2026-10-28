// Builds the playground into site/public: /play, /playground/embed.js, and the app-<hash>.js and worker-<hash>.js it loads.
// The pages load embed.js by a fixed name and the server makes browsers revalidate it; app and worker are named by their
// content and each names the next, worker <- app <- embed, so a browser never pairs a new embed with a cached old worker.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";

const here = (path: string) => new URL(path, import.meta.url).pathname;
const out = here("../public/playground");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/** Builds one entry with the given constants and returns its file name. */
const bundle = async (entry: string, define: Record<string, string> = {}, naming = "[name]-[hash].[ext]") => {
  const result = await Bun.build({
    entrypoints: [here(entry)],
    outdir: out,
    target: "browser",
    format: "esm",
    minify: true,
    naming,
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
await bundle("embed.ts", { APP_FILE: app }, "[name].[ext]");

copyFileSync(here("play.html"), here("../public/play.html"));
