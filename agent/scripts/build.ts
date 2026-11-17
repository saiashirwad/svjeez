import { dirname, join } from "node:path";

import { library } from "./library.ts";

const ROOT = join(import.meta.dir, "..");

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

/**
 * Bundles `entry` into `outfile` with the library inlined as the module "virtual:library". The Worker takes only
 * `validateSvg` from svjeez/frames, which also drives Chromium, so that import resolves to the pure validator alone.
 */
export const bundle = async (entry: string, outfile: string) => {
  const value = await library(join(ROOT, "dist/.library"), join(ROOT, "node_modules/.cache/fonts"));
  const source = `export default ${JSON.stringify(value)};`;
  const validate = join(ROOT, "../packages/svjeez/src/validate.ts");

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: dirname(outfile),
    naming: outfile.slice(dirname(outfile).length + 1),
    target: "browser",
    format: "esm",
    conditions: ["@svjeez/source"],
    // The Workers runtime provides it; the Session class extends its DurableObject.
    external: ["cloudflare:workers"],
    minify: true,
    // Names this build, so the sandbox never reuses an isolate holding another deploy's library.
    define: { BUILD: JSON.stringify(Date.now().toString(36)) },
    plugins: [
      {
        name: "agent",
        setup(build) {
          build.onResolve({ filter: /^virtual:library$/ }, () => ({
            path: "library",
            namespace: "virtual",
          }));
          build.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({
            contents: source,
            loader: "js",
          }));
          build.onResolve({ filter: /^svjeez\/frames$/ }, () => ({ path: validate }));
        },
      },
    ],
    throw: false,
  });

  if (!result.success) throw new AggregateError(result.logs, `${entry} did not build.`);

  const sum = (record: Readonly<Record<string, string>>) =>
    Object.values(record).reduce((total, text) => total + text.length, 0);

  const bytes = await Bun.file(outfile).arrayBuffer();

  return {
    worker: bytes.byteLength,
    gzipped: Bun.gzipSync(bytes).byteLength,
    library: sum(value.code),
    fonts: Object.values(value.fonts).reduce((total, b64) => total + (b64.length * 3) / 4, 0),
    atlas: sum(value.json),
    skill: sum(value.skill),
  };
};

if (import.meta.main) {
  const size = await bundle(join(ROOT, "src/index.ts"), join(ROOT, "dist/worker.js"));

  console.log(
    `✓ dist/worker.js  ${kb(size.worker)} · ${kb(size.gzipped)} gzipped (library ${kb(size.library)}, fonts ${kb(size.fonts)}, world-atlas ${kb(size.atlas)}, skill ${kb(size.skill)})`,
  );
}
