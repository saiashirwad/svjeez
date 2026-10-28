// Builds the playground into site/public: /play, and /playground/{embed,app,worker}.js for embedding.
import { copyFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

const here = (path: string) => new URL(path, import.meta.url).pathname;
const out = here("../public/playground");

mkdirSync(out, { recursive: true });
const result = await Bun.build({
  entrypoints: ["embed.ts", "app.ts", "worker.ts"].map(here),
  outdir: out,
  target: "browser",
  format: "esm",
  minify: true,
  naming: "[name].[ext]",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
copyFileSync(here("play.html"), here("../public/play.html"));

for (const output of result.outputs) {
  const text = await output.text();
  console.log(`${output.path.split("/").pop()!.padEnd(10)} ${String(text.length).padStart(7)} B  ${String(gzipSync(text).length).padStart(7)} B gzip`);
}
