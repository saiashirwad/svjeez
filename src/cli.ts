#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { renderFrames, type FrameTimes } from "./frames";
import { validateSvg } from "./validate";

const USAGE = `usage:
  svjeez svg <file> [--out file.svg]
  svjeez render <file> [--times 0,0.5,1 | --count 6] [--out frames/] [--sheet] [--columns 4] [--scale 2] [--scheme light|dark] [--background css]

<file> is an .svg, or a module whose default export is an SVG string or a function returning one.
Times are playback seconds. Without --times, render takes --count frames (default 6) across one loop.
Node cannot load .tsx: run \`bunx --bun svjeez\`, or pass an .svg or compiled .js file.`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const loadSvg = async (file: string): Promise<string> => {
  const path = resolve(file);
  if (path.endsWith(".svg")) return readFile(path, "utf8");
  const module = (await import(pathToFileURL(path).href).catch((error: Error & { code?: string }) => {
    if (error.code === "ERR_UNKNOWN_FILE_EXTENSION") fail(`Node cannot load ${file}. Run \`bunx --bun svjeez\`, or compile it to .js first.`);
    throw error;
  })) as { default?: unknown };
  const value = typeof module.default === "function" ? await module.default() : module.default;
  if (typeof value !== "string") fail(`${file} must export default an SVG string, or a function that returns one.`);
  return value as string;
};

const number = (flag: string, value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fail(`--${flag} needs a number, got "${value}".`);
};

const when = (times: string | undefined, count: string | undefined): FrameTimes => {
  if (times !== undefined && count !== undefined) fail("Pass --times or --count, not both.");
  if (times !== undefined) return { times: times.split(",").map((time) => number("times", time.trim())!) };
  const frames = number("count", count) ?? 6;
  return Number.isInteger(frames) && frames > 0 ? { count: frames } : fail(`--count needs a positive whole number, got ${frames}.`);
};

const report = (svg: string): void => {
  for (const warning of validateSvg(svg).warnings) console.warn(`warning: ${warning}`);
};

const svgCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { out: { type: "string", short: "o" } } });
  const svg = await loadSvg(positionals[0] ?? fail(USAGE));
  report(svg);
  if (values.out) await writeFile(values.out, svg);
  else process.stdout.write(svg);
};

const renderCommand = async (args: string[]): Promise<void> => {
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
      scheme: { type: "string" },
      background: { type: "string" },
    },
  });
  if (values.scheme !== undefined && values.scheme !== "light" && values.scheme !== "dark") fail(`--scheme is light or dark, got "${values.scheme}".`);
  const svg = await loadSvg(positionals[0] ?? fail(USAGE));
  report(svg);
  const { duration, frames, sheet } = await renderFrames(svg, {
    ...when(values.times, values.count),
    scale: number("scale", values.scale),
    colorScheme: values.scheme as "light" | "dark" | undefined,
    background: values.background,
    sheet: values.sheet ? { columns: number("columns", values.columns) } : false,
  });
  await mkdir(values.out, { recursive: true });
  const written = await Promise.all(
    frames.map(async ({ time, png }) => {
      const path = join(values.out, `frame-${time.toFixed(3).replace(".", "_")}s.png`);
      await writeFile(path, png);
      return path;
    }),
  );
  if (sheet) {
    written.push(join(values.out, "sheet.png"));
    await writeFile(join(values.out, "sheet.png"), sheet);
  }
  console.log(`loop ${Number(duration.toFixed(3))}s\n${written.join("\n")}`);
};

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = { svg: svgCommand, render: renderCommand };

const [command = "", ...args] = process.argv.slice(2);
const run = COMMANDS[command] ?? (() => fail(USAGE));
await run(args).catch((error: Error) => fail(error.stack ?? error.message));
