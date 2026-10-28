#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { renderFrames, type FrameTimes } from "./frames";
import { validateSvg } from "./validate";

const USAGE = `usage:
  svjeez svg <file> [--out file.svg]
  svjeez skill [--install [--dir .claude/skills]]
  svjeez frames <file> [--times 0,0.5,1 | --count 6] [--out frames/] [--sheet] [--columns 4 (implies --sheet)] [--scale 2] [--color-scheme system|light|dark] [--background css]
  svjeez video <file> [--out scene.mp4] [--format mp4|webm] [--fps 30] [--loops 1] [--quality low|medium|high] [--scale 2] [--color-scheme system|light|dark] [--background css]

<file> is an .svg, or a module whose default export is an SVG string or a function returning one.
Times are playback seconds. Without --times, frames takes --count frames (default 6) across one loop.
video encodes --loops loops of the scene, through @svjeez/video. Its format follows --out's extension, else mp4.
--background transparent keeps alpha, in webm only.
On Node, .tsx files load through tsx when it is installed.
skill prints the agent skill for writing svjeez scenes; --install copies it, with its references and examples, into <dir>/svjeez.`;

const SCHEMES = ["system", "light", "dark"] as const;

const isScheme = (value: string): value is (typeof SCHEMES)[number] =>
  SCHEMES.some((scheme) => scheme === value);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

type SceneExport = string | (() => string | Promise<string>);

const isSceneFunction = (value: SceneExport | undefined): value is () => string | Promise<string> =>
  typeof value === "function";

const isText = (value: string | undefined): value is string => typeof value === "string";

const loadSvg = async (file: string): Promise<string> => {
  const path = resolve(file);

  if (path.endsWith(".svg")) return readFile(path, "utf8");
  const url = pathToFileURL(path).href;

  const module: { default?: SceneExport } = await import(url).catch(
    async (error: Error & { code?: string }) => {
      if (error.code !== "ERR_UNKNOWN_FILE_EXTENSION") throw error;

      // Node has no TSX loader of its own; use tsx when the project has it.
      const tsx = (() => {
        try {
          return pathToFileURL(
            createRequire(join(process.cwd(), "package.json")).resolve("tsx/esm/api"),
          ).href;
        } catch {
          return "tsx/esm/api";
        }
      })();

      const { register }: { register: () => void } = await import(tsx).catch(() =>
        fail(
          `Node cannot load ${file}. Install tsx, run \`bunx --bun svjeez\`, or compile it to .js first.`,
        ),
      );

      register();

      return import(url);
    },
  );

  const value = isSceneFunction(module.default) ? await module.default() : module.default;

  if (isText(value)) return value;

  return fail(`${file} must export default an SVG string, or a function that returns one.`);
};

const number = (flag: string, value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fail(`--${flag} needs a number, got "${value}".`);
};

const when = (times: string | undefined, count: string | undefined): FrameTimes => {
  if (times !== undefined && count !== undefined) fail("Pass --times or --count, not both.");

  if (times !== undefined)
    return {
      times: times
        .split(",")
        .map((time) =>
          time.trim() === ""
            ? fail(`--times has an empty entry: "${times}".`)
            : number("times", time.trim())!,
        ),
    };
  const frames = number("count", count) ?? 6;

  return Number.isInteger(frames) && frames > 0
    ? { count: frames }
    : fail(`--count needs a positive whole number, got ${frames}.`);
};

const report = (svg: string): void => {
  for (const warning of validateSvg(svg).warnings) console.warn(`warning: ${warning}`);
};

const svgCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: "string", short: "o" } },
  });

  const svg = await loadSvg(positionals[0] ?? fail(USAGE));
  report(svg);

  if (values.out) await writeFile(values.out, svg);
  else process.stdout.write(svg);
};

const parseScheme = (value: string | undefined) =>
  value === undefined
    ? undefined
    : isScheme(value)
      ? value
      : fail(`--color-scheme is system, light or dark, got "${value}".`);

/** The part of @svjeez/video the CLI uses. svjeez doesn't depend on it, so it is typed here. */
interface VideoModule {
  renderVideo: (
    svg: string,
    options: {
      format: string;
      fps?: number;
      loops?: number;
      quality?: string;
      scale?: number;
      colorScheme?: string;
      background?: string;
    },
  ) => Promise<{
    bytes: Uint8Array;
    codec: string;
    frames: number;
    duration: number;
    colorScheme: string;
  }>;
}

const VIDEO = "@svjeez/video";

// From the project first, so a package manager that doesn't hoist still finds it.
const loadVideo = async (): Promise<VideoModule> => {
  const from = (base: string) => {
    try {
      return pathToFileURL(createRequire(base).resolve(VIDEO)).href;
    } catch {
      return undefined;
    }
  };

  const url =
    from(join(process.cwd(), "package.json")) ??
    from(fileURLToPath(import.meta.url)) ??
    fail(`svjeez video needs ${VIDEO}. Install it with \`npm i -D ${VIDEO}\`.`);

  return import(url);
};

const videoCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string" },
      fps: { type: "string" },
      loops: { type: "string" },
      quality: { type: "string" },
      scale: { type: "string" },
      "color-scheme": { type: "string" },
      background: { type: "string" },
    },
  });

  const file = positionals[0] ?? fail(USAGE);
  const extension = values.out ? extname(values.out).slice(1) : "";
  const named = extension === "mp4" || extension === "webm" ? extension : undefined;
  const format = values.format ?? named ?? "mp4";

  if (named && named !== format)
    fail(`--format ${format} doesn't match --out ${values.out}. Pass one, or make them agree.`);
  const out = values.out ?? `${basename(file, extname(file))}.${format}`;
  const colorScheme = parseScheme(values["color-scheme"]);
  const { renderVideo } = await loadVideo();
  const svg = await loadSvg(file);
  report(svg);

  const video = await renderVideo(svg, {
    format,
    fps: number("fps", values.fps),
    loops: number("loops", values.loops),
    quality: values.quality,
    scale: number("scale", values.scale),
    colorScheme,
    background: values.background,
  });

  await writeFile(out, video.bytes);
  console.log(
    `${out}: ${video.codec}, ${video.frames} frames, ${Number(video.duration.toFixed(3))}s, ${video.colorScheme}`,
  );
};

const framesCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      times: { type: "string", short: "t" },
      count: { type: "string", short: "n" },
      out: { type: "string", short: "o", default: "frames" },
      sheet: { type: "boolean" },
      columns: { type: "string" },
      scale: { type: "string" },
      "color-scheme": { type: "string" },
      background: { type: "string" },
    },
  });

  const scheme = parseScheme(values["color-scheme"]);
  const svg = await loadSvg(positionals[0] ?? fail(USAGE));
  report(svg);

  const { duration, colorScheme, frames, sheet } = await renderFrames(svg, {
    ...when(values.times, values.count),
    scale: number("scale", values.scale),
    colorScheme: scheme,
    background: values.background,
    sheet:
      values.sheet || values.columns !== undefined
        ? { columns: number("columns", values.columns) }
        : false,
  });

  await mkdir(values.out, { recursive: true });

  const written = await Promise.all(
    frames.map(async ({ time, png }, index) => {
      const path = join(
        values.out,
        `frame-${String(index).padStart(2, "0")}-${time.toFixed(3).replace(".", "_")}s.png`,
      );

      await writeFile(path, png);

      return path;
    }),
  );

  if (sheet) {
    written.push(join(values.out, "sheet.png"));
    await writeFile(join(values.out, "sheet.png"), sheet);
  }

  console.log(`loop ${Number(duration.toFixed(3))}s, ${colorScheme}\n${written.join("\n")}`);
};

// package-dist/cli.js and src/cli.ts both sit one level under the package root.
const SKILL = fileURLToPath(new URL("../skills/svjeez", import.meta.url));

const skillCommand = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      install: { type: "boolean" },
      dir: { type: "string", default: join(".claude", "skills") },
    },
  });

  if (!values.install) {
    process.stdout.write(await readFile(join(SKILL, "SKILL.md"), "utf8"));

    return;
  }

  const target = resolve(values.dir, "svjeez");
  await cp(SKILL, target, { recursive: true, force: true });
  console.log(`installed the svjeez skill in ${relative(process.cwd(), target) || "."}`);
};

const COMMANDS = new Map([
  ["svg", svgCommand],
  ["frames", framesCommand],
  ["video", videoCommand],
  ["skill", skillCommand],
]);

const [command = "", ...args] = process.argv.slice(2);
const run = COMMANDS.get(command) ?? (() => fail(USAGE));

await run(args).catch((error: Error) => fail(error.stack ?? error.message));
