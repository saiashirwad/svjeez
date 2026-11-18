#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkScene, renderFrames, type FrameTimes } from "./frames";
import { parse, type Json, type JsonObject, type Param, type Schema, type Values } from "./params";
import { isScene, svg, type Diagnostic, type Scene } from "./scene";
import { startTrace, stopTrace, type BuildReport } from "./traced";
import { timelineCues } from "./check";
import { validateSvg } from "./validate";

const USAGE = `usage:
  svjeez svg <file> [--out file.svg] [--json] [params]
  svjeez dev <file> [--port 5173] [--out file.svg] [params]
  svjeez frames <file> [--times 0,0.5,1 | --count 6] [--out frames/] [--sheet] [--columns 4 (implies --sheet)] [--scale 2] [--color-scheme system|light|dark] [--background css] [params]
  svjeez check <file> [--times 0,0.5,1] [--json] [--color-scheme system|light|dark] [params]
  svjeez values <file> [--json] [--filter text]
  svjeez set <file> key=value [key=value ...] [--dry-run]
  svjeez video <file> [--out scene.mp4] [--format mp4|webm] [--fps 30] [--loops 1] [--quality low|medium|high] [--scale 2] [--color-scheme system|light|dark] [--background css] [params]
  svjeez skill [--install [--dir .claude/skills]]

<file> is an .svg, or a module whose default export is a scene from svjeez/scene, an SVG string, or a function
returning either.
[params] is --params data.json and any number of --param key=value. They fill the module's exported \`params\` schema
(from svjeez/params), are checked against it, and are passed to the default export; a key left out keeps its default.
--param sets one value that is not a list, and wins over the file.
Times are scene seconds. Without --times, frames takes --count frames (default 6) across one loop.
dev serves a preview with a scrubber and a timeline, and rebuilds it when a file beside it changes.
svg --json includes the SVG, compiler warnings and timeline tracks in scene seconds.
video encodes --loops loops of the scene, through @svjeez/video. Its format follows --out's extension, else mp4.
--background transparent keeps alpha, in webm only.
On Node, .tsx files load through tsx when it is installed.
check measures the scene in headless Chromium and prints one finding per line, file:line:column  rule  severity: message.
It exits 1 when any finding is an error. Without --times it measures 0, seven times across the loop, and just before the end.
values lists every number, color, ease and param in the scene's source that the editor shows a control for, with its key;
set writes key=value into those literals and changes nothing else. Both read the source without running a browser,
through @svjeez/live.
skill prints the agent skill for writing svjeez scenes; --install copies it, with its references and examples, into <dir>/svjeez.`;

const SCHEMES = ["system", "light", "dark"] as const;

const isScheme = (value: string): value is (typeof SCHEMES)[number] =>
  SCHEMES.some((scheme) => scheme === value);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

type Built = string | Scene;

type Build = (values?: Values<Schema>) => Built | Promise<Built>;

interface SceneModule {
  readonly default?: Built | Build;
  readonly params?: Schema;
}

const isBuild = (value: SceneModule["default"]): value is Build => typeof value === "function";

const isText = (value: unknown): value is string => typeof value === "string";

const isParam = (p: Param | undefined): p is Param =>
  typeof p === "object" && p !== null && "kind" in p;

const isSchema = (value: SceneModule["params"]): value is Schema =>
  typeof value === "object" && value !== null && Object.values(value).every(isParam);

const isJsonObject = (value: Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface ParamFlags {
  readonly params?: string;
  readonly param?: readonly string[];
}

const PARAM_OPTIONS = {
  params: { type: "string" },
  param: { type: "string", multiple: true },
} as const;

const paramArgs = ({ params, param = [] }: ParamFlags): string[] => [
  ...(params === undefined ? [] : ["--params", params]),
  ...param.flatMap((pair) => ["--param", pair]),
];

const valuesFor = async (
  file: string,
  schema: Schema,
  flags: ParamFlags,
): Promise<Values<Schema>> => {
  const text =
    flags.params === undefined
      ? "{}"
      : await readFile(flags.params, "utf8").catch(() =>
          fail(
            `--params ${flags.params}: no such file. Pass a JSON file of values for ${file}'s params.`,
          ),
        );

  const json = ((): Json => {
    try {
      return JSON.parse(text);
    } catch (error) {
      return fail(
        `--params ${flags.params} is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();

  const pairs = (flags.param ?? []).map((pair): [string, Json] => {
    const equals = pair.indexOf("=");

    if (equals < 1) fail(`--param needs key=value, got "${pair}".`);
    const key = pair.slice(0, equals);
    const raw = pair.slice(equals + 1);
    const declared = Object.hasOwn(schema, key) ? schema[key] : undefined;

    if (declared?.kind === "list")
      fail(`--param ${key} is a list. Put lists in a JSON file and pass it with --params.`);
    const asNumber = raw.trim() === "" ? NaN : Number(raw);

    return [key, declared?.kind === "number" && Number.isFinite(asNumber) ? asNumber : raw];
  });

  const given = isJsonObject(json)
    ? json
    : fail(`--params ${flags.params} needs a JSON object keyed by param name.`);

  try {
    return parse(schema, { ...given, ...Object.fromEntries(pairs) });
  } catch (error) {
    return fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const warn = (warning: Diagnostic): void => console.warn(`warning: ${warning.message}`);

/** A scene model's diagnostics go to `onWarning`; an SVG string's warnings are the caller's to read. */
const loadSvg = async (
  file: string,
  flags: ParamFlags = {},
  onWarning: (warning: Diagnostic) => void = warn,
): Promise<string> => {
  const path = resolve(file);
  const given = flags.params !== undefined || (flags.param?.length ?? 0) > 0;

  if (path.endsWith(".svg")) {
    if (given)
      fail(`${file} is an SVG, so it has no params to fill. Pass the scene module instead.`);

    return readFile(path, "utf8");
  }

  const url = pathToFileURL(path).href;

  const module: SceneModule = await import(url).catch(async (error: Error & { code?: string }) => {
    if (error.code !== "ERR_UNKNOWN_FILE_EXTENSION") throw error;

    const api = "tsx/esm/api";

    const { register }: { register: () => void } = await import(api)
      .catch(async (error: Error & { code?: string }) => {
        if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;

        const manifest = createRequire(join(process.cwd(), "package.json")).resolve(
          "tsx/package.json",
        );

        const { exports }: { exports: { "./esm/api"?: { import: string | { default: string } } } } =
          JSON.parse(await readFile(manifest, "utf8"));

        const entry = exports["./esm/api"]?.import;

        if (!entry) throw error;

        // createRequire resolves the CommonJS branch, whose loader registration fails on Node 20.
        return import(new URL(isText(entry) ? entry : entry.default, pathToFileURL(manifest)).href);
      })
      .catch(() =>
        fail(
          `Node cannot load ${file}. Install tsx, run \`bunx --bun svjeez\`, or compile it to .js first.`,
        ),
      );

    register();

    // Node 20 remembers the failed import at the original URL.
    return import(new URL("?svjeez-tsx", url).href);
  });

  const schema = isSchema(module.params) ? module.params : undefined;

  if (given && !schema)
    fail(
      `${file} has no \`export const params\` schema, so --params and --param have nothing to fill. Declare one with svjeez/params, or drop the flags.`,
    );

  const values = schema ? await valuesFor(file, schema, flags) : undefined;

  const value = isBuild(module.default)
    ? await (values === undefined ? module.default() : module.default(values))
    : module.default;

  if (isScene(value)) return svg.emit(value, { onWarning });

  if (isText(value)) return value;

  return fail(
    `${file} must export default a scene, as in \`export default scene({ ... }, () => ...)\`, an SVG string, or a function that returns either.`,
  );
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

const reportWarnings = (warnings: readonly string[]): void => {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
};

const report = (svg: string): void => reportWarnings(validateSvg(svg).warnings);

const loadBuild = async (
  file: string,
  flags: ParamFlags,
  inspect = false,
  sources = false,
): Promise<BuildReport & { svg: string }> => {
  let captured: { svg: string; report: BuildReport } | undefined;
  const diagnosed: string[] = [];
  startTrace({
    within: inspect && !file.endsWith(".svg") ? dirname(resolve(file)) : undefined,
    sources,
    onRender: (svg, report) => {
      captured = { svg, report };
    },
  });

  try {
    const svg = await loadSvg(file, flags, (warning) => diagnosed.push(warning.message));

    if (captured?.svg === svg)
      return {
        svg,
        ...captured.report,
        warnings: [...diagnosed, ...captured.report.warnings],
      };

    return { svg, warnings: [...diagnosed, ...validateSvg(svg).warnings], timeline: [] };
  } finally {
    stopTrace();
  }
};

const svgCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      json: { type: "boolean" },
      ...PARAM_OPTIONS,
    },
  });

  const built = await loadBuild(positionals[0] ?? fail(USAGE), values, values.json);

  if (!values.json) reportWarnings(built.warnings);

  if (values.out) await writeFile(values.out, built.svg);

  if (values.json) console.log(JSON.stringify(built));
  else if (!values.out) process.stdout.write(built.svg);
};

const parseScheme = (value: string | undefined) =>
  value === undefined
    ? undefined
    : isScheme(value)
      ? value
      : fail(`--color-scheme is system, light or dark, got "${value}".`);

type VideoFn = (
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
  playTime: number;
  colorScheme: string;
}>;

interface VideoModule {
  readonly video?: VideoFn;
}

const VIDEO = "@svjeez/video";

const loadOptional = async (name: string, command: string, pkg = name): Promise<object> => {
  const from = (base: string) => {
    try {
      return pathToFileURL(createRequire(base).resolve(name)).href;
    } catch {
      return undefined;
    }
  };

  const url =
    from(join(process.cwd(), "package.json")) ??
    from(fileURLToPath(import.meta.url)) ??
    fail(`svjeez ${command} needs ${pkg}. Install it with \`npm i -D ${pkg}\`.`);

  return import(url);
};

const loadVideo = (): Promise<VideoModule> => loadOptional(VIDEO, "video");

type LiveCommand = (args: string[]) => Promise<number>;

interface LiveModule {
  readonly values?: LiveCommand;
  readonly set?: LiveCommand;
}

const liveCommand =
  (name: "values" | "set") =>
  async (args: string[]): Promise<void> => {
    const live: LiveModule = await loadOptional("@svjeez/live/commands", name, "@svjeez/live");

    const run =
      live[name] ?? fail(`@svjeez/live has no ${name} command. Update it to match svjeez.`);

    process.exitCode = await run(args).catch((error: Error) =>
      error.name === "SetError" ? fail(error.message) : Promise.reject(error),
    );
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
      ...PARAM_OPTIONS,
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
  const loaded = await loadVideo();
  const encode = loaded.video ?? fail(`${VIDEO} has no video().`);
  const svg = await loadSvg(file, values);
  report(svg);

  const video = await encode(svg, {
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
    `${out}: ${video.codec}, ${video.frames} frames, ${Number(video.playTime.toFixed(3))}s, ${video.colorScheme}`,
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
      ...PARAM_OPTIONS,
    },
  });

  const scheme = parseScheme(values["color-scheme"]);
  const svg = await loadSvg(positionals[0] ?? fail(USAGE), values);
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

const checkCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      times: { type: "string", short: "t" },
      json: { type: "boolean" },
      "color-scheme": { type: "string" },
      ...PARAM_OPTIONS,
    },
  });

  const file = positionals[0] ?? fail(USAGE);
  const scheme = parseScheme(values["color-scheme"]);
  const times = values.times === undefined ? undefined : when(values.times, undefined);

  const built = await loadBuild(file, values, true, true);
  reportWarnings(built.warnings);

  const {
    duration,
    times: measured,
    findings,
  } = await checkScene(built.svg, {
    times: times && "times" in times ? times.times : undefined,
    cues:
      times || built.duration === undefined
        ? undefined
        : timelineCues(built.timeline, built.duration),
    colorScheme: scheme,
  });

  const where = (source: string | undefined): string => {
    if (!source) return file;
    const match = /^(.*?)((?::\d+){1,2})$/.exec(source);

    return match?.[1]
      ? `${relative(process.cwd(), match[1]) || match[1]}${match[2]}`
      : `${file}:${source}`;
  };

  const errors = findings.filter((found) => found.severity === "error").length;

  if (values.json)
    console.log(
      JSON.stringify(
        {
          duration,
          times: measured,
          findings: findings.map((found) => ({ ...found, source: where(found.source) })),
        },
        null,
        2,
      ),
    );
  else {
    for (const found of findings)
      console.log(`${where(found.source)}  ${found.rule}  ${found.severity}: ${found.message}`);

    const warnings = findings.length - errors;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    console.log(
      `${plural(errors, "error")}, ${plural(warnings, "warning")}; loop ${Number(duration.toFixed(3))}s, measured at ${measured.map((time) => Number(time.toFixed(3))).join(", ")}`,
    );
  }

  if (errors > 0) process.exitCode = 1;
};

const devCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { port: { type: "string" }, out: { type: "string", short: "o" }, ...PARAM_OPTIONS },
  });

  const file = positionals[0] ?? fail(USAGE);
  const port = number("port", values.port ?? process.env.PORT);

  if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port < 65536))
    fail(`--port needs a whole number from 0 to 65535, got ${port}.`);
  const self = fileURLToPath(import.meta.url);
  const { dev } = await import("./dev");

  await dev({
    file,
    cli: self,
    args: paramArgs(values),
    files: values.params === undefined ? [] : [values.params],
    dirs: self.endsWith(".ts") ? [dirname(self)] : [],
    port,
    out: values.out,
  });
};

const COMMANDS = new Map([
  ["svg", svgCommand],
  ["dev", devCommand],
  ["check", checkCommand],
  ["frames", framesCommand],
  ["values", liveCommand("values")],
  ["set", liveCommand("set")],
  ["video", videoCommand],
  ["skill", skillCommand],
]);

const [command = "", ...args] = process.argv.slice(2);
const run = COMMANDS.get(command) ?? (() => fail(USAGE));

await run(args).catch((error: Error) => fail(error.stack ?? error.message));
