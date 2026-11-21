// The single-file svjeez: the CLI with every package it can carry inside it. A scene file anywhere imports svjeez and
// @svjeez/* from here, with no package.json, node_modules or tsconfig beside it.

import { plugin } from "bun";
import { readFile } from "node:fs/promises";
import { setHost } from "svjeez/tools";
import { assets } from "./assets";
import { USAGE, browserCommand, downloadChild, initCommand } from "./commands";
import { MODULES } from "./modules";
import { typeProblems } from "./types";

// scripts/build.ts defines it in the binary; from source it is unset.
const built = process.env.SVJEEZ_VERSION;
const compiled = built !== undefined;
const version = built ?? "source";

if (!(await downloadChild(process.argv))) {
  plugin({
    name: "svjeez-carried",
    setup(build) {
      for (const [specifier, load] of MODULES)
        build.module(specifier, async () => ({ exports: { ...(await load()) }, loader: "object" }));

      // A lone scene has no tsconfig to name the JSX runtime, so name it in the file. On the first line, so every
      // line keeps its number in stacks and messages.
      build.onLoad({ filter: /\.[jt]sx$/ }, async ({ path }) => ({
        contents: `/** @jsxImportSource svjeez */ ${await readFile(path, "utf8")}`,
        loader: path.endsWith(".jsx") ? "jsx" : "tsx",
      }));
    },
  });

  setHost({
    version: `${version} (single-file binary, bun ${Bun.version})`,
    // A compiled binary runs itself; from source, bun runs this file again.
    self: compiled ? [process.execPath] : [process.execPath, ...process.execArgv, Bun.main],
    skill: async () => {
      const { skill, skillBinary } = await assets();

      return new Map<string, string | Uint8Array>([
        ...Object.entries(skill),
        ...Object.entries(skillBinary).map(
          ([path, data]) => [path, Buffer.from(data, "base64")] as const,
        ),
      ]);
    },
    module: (name) => MODULES.get(name)?.(),
    check: typeProblems,
    commands: new Map([
      ["init", initCommand],
      ["browser", browserCommand],
    ]),
    usage: USAGE,
    installBrowser: "svjeez browser install",
  });

  await import("../../svjeez/src/cli.ts");
}
