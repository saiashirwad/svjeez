import { copyFile, readdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("package-dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [
    "./src/index.ts",
    "./src/jsx-runtime.ts",
    "./src/jsx-dev-runtime.ts",
    "./src/tools.ts",
    "./src/frames.ts",
    "./src/page.ts",
    "./src/cli.ts",
  ],
  external: ["playwright-core"],
  root: "./src",
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

for (const file of await readdir("package-dist", { recursive: true })) {
  if (!file.endsWith(".d.ts")) continue;
  const path = `package-dist/${file}`;
  const contents = await readFile(path, "utf8");

  // typegpu is an optional peer, and the types that name it must still compile for a consumer without it (as `any`), which
  // `skipLibCheck: false` would otherwise report as a missing module.
  const optional = contents.replace(
    /^(import\s[^\n]*\sfrom\s+"typegpu";)$/gm,
    "// @ts-ignore typegpu is an optional peer\n$1",
  );

  await writeFile(path, optional.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, "$1$2.js$3"));
}

for (const file of ["README.md", "LICENSE"]) await copyFile(`../../${file}`, file);
