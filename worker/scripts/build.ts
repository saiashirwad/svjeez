import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const result = await Bun.build({
  entrypoints: [join(ROOT, "src/index.ts")],
  outdir: join(ROOT, "dist"),
  naming: "worker.js",
  target: "browser",
  format: "esm",
  conditions: ["@svjeez/source"],
  // The Workers runtime provides it; the Session class extends its DurableObject.
  external: ["cloudflare:workers"],
  minify: true,
  // A deploy starts a new cache, so the last build's responses are not served for this one.
  define: { BUILD: JSON.stringify(Date.now().toString(36)) },
  throw: false,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const [output] = result.outputs;
const bytes = output ? await output.arrayBuffer() : new ArrayBuffer(0);

console.log(
  `✓ dist/worker.js  ${(bytes.byteLength / 1024).toFixed(0)} KB · ${(Bun.gzipSync(bytes).byteLength / 1024).toFixed(0)} KB gzipped`,
);
