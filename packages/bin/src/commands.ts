import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { assets } from "./assets";
import { tsconfigFor } from "./types";

export const USAGE = `  svjeez init [dir] [--force]
  svjeez browser install

init readies a folder for scenes: it copies the types of everything the binary carries into <dir>/.svjeez/types,
writes a tsconfig.json that points at them (--force replaces one already there), and a scene.tsx when the folder has
no scene yet. Editors then know svjeez; svjeez check reports type errors without it.
browser install downloads the headless Chromium that frames, video and check --browser render with. Without it they
use an installed Google Chrome.`;

const STARTER = `import { google } from "@svjeez/fonts";
import { Group, Shape, Text, circle, ease, enter, scene, span, track } from "svjeez";

// Fetched from Google Fonts on the first run, then read from ~/.cache/svjeez/fonts.
const geist = await google("Geist");

export default scene(
  {
    size: [320, 180],
    duration: 3,
    loop: false,
    title: "Hello",
    desc: "A dot drops in and the word hello fades in beside it.",
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#0E1014" />
      <Shape
        key="dot"
        geometry={circle(18)}
        anchor="center"
        at={track([110, 40]).to([110, 90], span(0.2, 0.8), ease.out)}
        fill="#5EA0FF"
        motion={[enter(span(0.2, 0.3))]}
      />
      <Text key="word" font={geist} size={28} at={[140, 100]} fill="#E5E5EA" motion={[enter(span(0.8, 0.5))]}>
        hello
      </Text>
    </Group>
  ),
);
`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

export const initCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { force: { type: "boolean" } },
  });

  const folder = resolve(positionals[0] ?? ".");
  const given = await assets();
  const home = join(folder, ".svjeez");
  const types = join(home, "types");
  const wrote: string[] = [];

  const files = [
    ...Object.entries(given.types).map(([path, text]) => [join(types, path), text] as const),
    ...Object.entries(given.node).map(
      ([path, text]) => [join(home, "node_modules", path), text] as const,
    ),
  ];

  for (const [path, text] of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }

  await writeFile(join(home, ".gitignore"), "*\n");
  wrote.push(`.svjeez/types (svjeez ${given.version})`);

  const tsconfig = join(folder, "tsconfig.json");

  if (existsSync(tsconfig) && !values.force)
    console.warn(
      "tsconfig.json is already here, so it was left alone. Run with --force to replace it, or copy the paths from `svjeez init --force` in an empty folder.",
    );
  else {
    await writeFile(tsconfig, `${JSON.stringify(tsconfigFor(given, folder, home), null, 2)}\n`);
    wrote.push("tsconfig.json");
  }

  const scenes = readdirSync(folder).filter((name) => /\.[jt]sx$/.test(name));

  if (scenes.length === 0) {
    await writeFile(join(folder, "scene.tsx"), STARTER);
    wrote.push("scene.tsx");
  }

  const where = relative(process.cwd(), folder) || ".";
  console.log(`wrote ${wrote.join(", ")} in ${where}`);

  if (scenes.length === 0)
    console.log(
      `next: svjeez check ${join(where, "scene.tsx")}, then svjeez frames ${join(where, "scene.tsx")} --sheet`,
    );
};

const registry = async () => (await import("playwright-core/lib/coreBundle")).registry;

export const browserCommand = async (args: string[]): Promise<void> => {
  if (args[0] !== "install") fail(`usage:\n  svjeez browser install`);

  await (await registry()).installBrowsersForNpmInstall(["chromium-headless-shell"]);
};

/**
 * Playwright downloads a browser in a child process: it forks its oopBrowserDownload.js, which a compiled binary
 * runs as itself with that path as the first argument. Answer for it when that is the case.
 */
export const downloadChild = async (argv: readonly string[]): Promise<boolean> => {
  if (!argv[2]?.endsWith("oopBrowserDownload.js")) return false;

  (await registry()).runOopDownloadBrowserMain();

  return true;
};
