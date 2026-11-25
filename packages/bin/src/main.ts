import { plugin } from "bun";
import { readFile } from "node:fs/promises";
import { setHost } from "svjeez/tools";
import { assets } from "./assets";
import { USAGE, browserCommand, downloadChild, initCommand } from "./commands";
import { MODULES } from "./modules";
import { typeProblems } from "./types";

const built = process.env.SVJEEZ_VERSION;
const compiled = built !== undefined;
const version = built ?? "source";

if (!(await downloadChild(process.argv))) {
  plugin({
    name: "svjeez-carried",
    setup(build) {
      for (const [specifier, load] of MODULES)
        build.module(specifier, async () => ({ exports: { ...(await load()) }, loader: "object" }));

      build.onLoad({ filter: /\.[jt]sx$/ }, async ({ path }) => ({
        contents: `/** @jsxImportSource svjeez */ ${await readFile(path, "utf8")}`,
        loader: path.endsWith(".jsx") ? "jsx" : "tsx",
      }));
    },
  });

  setHost({
    version: `${version} (single-file binary, bun ${Bun.version})`,
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
