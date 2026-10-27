import { readdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("package-dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./src/index.ts", "./src/explain.ts", "./src/jsx-runtime.ts", "./src/jsx-dev-runtime.ts"],
  outdir: "./package-dist",
  target: "node",
  splitting: true,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const tsc = Bun.spawnSync(["./node_modules/.bin/tsc", "-p", "tsconfig.package.json"]);
if (tsc.exitCode !== 0) {
  process.stderr.write(tsc.stderr);
  process.stdout.write(tsc.stdout);
  process.exit(tsc.exitCode);
}

// Node's ESM type resolution requires extensions on relative declaration imports.
for (const file of await readdir("package-dist", { recursive: true })) {
  if (!file.endsWith(".d.ts")) continue;
  const path = `package-dist/${file}`;
  const contents = await readFile(path, "utf8");
  await writeFile(path, contents.replace(/(from\s+["'])(\.\/[^"']+)(["'])/g, "$1$2.js$3"));
}
