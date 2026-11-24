#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { examine } from "./check/report";
import { costOf, type Cost } from "./svg/cost";
import { checkPixels, renderFrames, type FrameTimes } from "./frames";
import { isRecord, parse, type Json, type Param, type Schema, type Values } from "./params";
import {
  describe,
  isScene,
  svg,
  type Diagnostic,
  type LaneReport,
  type Model,
  type Problem,
  type Scene,
  type Severity,
} from "./tools";
import { momentsOf, namesOf, sourcesOf } from "./check/survey";
import { startTrace, stopTrace, traceOf } from "./svg/traced";
import { validateSvg } from "./svg/validate";
import { isSceneError } from "./model/scene-error";
import { hostOf } from "./host";
import { isString } from "./model/guards";

const host = hostOf();

const USAGE = `usage:
  svjeez svg <file> [--out file.svg] [--json] [params]
  svjeez dev <file> [--port 5173] [--out file.svg] [params]
  svjeez frames <file> [--times 0,0.5,1 | --count 6] [--out frames/] [--sheet] [--columns 4 (implies --sheet)] [--scale 2] [--color-scheme system|light|dark] [--background css] [params]
  svjeez check <file> [--json | --format json|text] [--fail-on error|warning] [--browser] [--at 0,1.5] [--times 0,0.5,1] [--color-scheme system|light|dark] [params]
  svjeez video <file> [--out scene.mp4] [--format mp4|webm] [--fps 30] [--loops 1] [--quality low|medium|high] [--scale 2] [--color-scheme system|light|dark] [--background css] [params]
  svjeez skill [--install [--dir .claude/skills]]
  svjeez version

<file> is an .svg, or a module whose default export is a scene from svjeez, an SVG string, or a function
returning either.
[params] is --params data.json and any number of --param key=value. They fill the module's exported \`params\` schema
(built with param from svjeez), are checked against it, and are passed to the default export; a key left out keeps its default.
--param sets one value that is not a list, and wins over the file.
Times are scene seconds. Without --times, frames takes --count frames (default 6) across one loop.
dev serves a preview with a scrubber and a timeline, and rebuilds it when a file beside it changes.
svg --json prints { svg, warnings, lanes }: the SVG, its warnings and every animated lane, in scene seconds.
video encodes --loops loops of the scene, through @svjeez/video. Its format follows --out's extension, else mp4.
--background transparent keeps alpha, in webm only.
On Node, .tsx files load through tsx when it is installed.
check reads the scene model and emits its SVG once, with no browser, and prints one problem per line,
file:line:column  code  severity: message, with what to change on a fix: line below, then the count and the animated
lanes (css, or smil when a scene animates geometry, a filter or a gradient). --browser also measures the scene in
headless Chromium. --at 0,1.5 also describes what is on screen at those times. --times 0,0.5 adds moments to sample.
--json prints { ok, file, scene?, problems, lanes, cost?, measured?, frames?, timeline? }, cost being { animations, repaint }. It exits 1 when any problem is an
error, the scene failing to build included. With --browser and no --times the browser measures 0, seven times across
the loop, just before the end, and the scene's keys.
skill prints the agent skill for writing svjeez scenes; --install copies it, with its references and examples, into <dir>/svjeez.${host.usage ? `\n\n${host.usage}` : ""}`;

const SCHEMES = ["system", "light", "dark"] as const;

const isScheme = (value: string): value is (typeof SCHEMES)[number] =>
  SCHEMES.some((scheme) => scheme === value);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

type Built = string | Scene;

type Source = Model.Source;

type Build = (values?: Values<Schema>) => Built | Promise<Built>;

interface SceneModule {
  readonly default?: Built | Build;
  readonly params?: Schema;
}

const isBuild = (value: SceneModule["default"]): value is Build => typeof value === "function";

const isParam = (p: Param | undefined): p is Param =>
  typeof p === "object" && p !== null && "kind" in p;

const isSchema = (value: SceneModule["params"]): value is Schema =>
  typeof value === "object" && value !== null && Object.values(value).every(isParam);

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

  const given = isRecord(json)
    ? json
    : fail(`--params ${flags.params} needs a JSON object keyed by param name.`);

  try {
    return parse(schema, { ...given, ...Object.fromEntries(pairs) });
  } catch (error) {
    return fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Stacks name a file by its real path (macOS's /tmp is /private/tmp), so trace the real directory.
const sceneDir = (file: string): string => {
  const dir = dirname(resolve(file));

  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
};

const warn = (warning: Diagnostic): void => console.warn(`warning: ${warning.message}`);

const loadValue = async (
  file: string,
  flags: ParamFlags = {},
  problem: (message: string) => never = fail,
): Promise<Built> => {
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

        return import(
          new URL(isString(entry) ? entry : entry.default, pathToFileURL(manifest)).href
        );
      })
      .catch(() => {
        if (process.env.SVJEEZ_REEXEC !== "1") {
          const self = fileURLToPath(import.meta.url);

          const rerun = spawnSync("bun", [self, ...process.argv.slice(2)], {
            stdio: "inherit",
            env: { ...process.env, SVJEEZ_REEXEC: "1" },
          });

          if (!rerun.error) process.exit(rerun.status ?? 1);
        }

        return fail(
          `Node cannot load ${file}. Install tsx, run \`bunx --bun svjeez\`, or compile it to .js first.`,
        );
      });

    register();

    return import(new URL("?svjeez-tsx", url).href);
  });

  const schema = isSchema(module.params) ? module.params : undefined;

  if (given && !schema)
    fail(
      `${file} has no \`export const params\` schema, so --params and --param have nothing to fill. Declare one with param from svjeez, or drop the flags.`,
    );

  const values = schema ? await valuesFor(file, schema, flags) : undefined;

  const value = isBuild(module.default)
    ? await (values === undefined ? module.default() : module.default(values))
    : module.default;

  if (isScene(value) || isString(value)) return value;

  return problem(
    `${file} must export default a scene, as in \`export default scene({ ... }, () => ...)\`, an SVG string, or a function that returns either.`,
  );
};

const loadBuilt = async (
  file: string,
  flags: ParamFlags = {},
  onWarning: (warning: Diagnostic) => void = warn,
  onLane?: (lane: LaneReport) => void,
): Promise<{ readonly svg: string; readonly scene?: Scene }> => {
  const value = await loadValue(file, flags);

  if (isScene(value))
    return {
      svg: svg.emit(value, {
        onWarning,
        ...(onLane && { onLane }),
        sources: Boolean(traceOf()?.within ?? traceOf()?.sources),
      }),
      scene: value,
    };

  return { svg: value };
};

const loadSvg = async (file: string, flags: ParamFlags = {}): Promise<string> =>
  (await loadBuilt(file, flags)).svg;

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

interface SvgBuild {
  readonly svg: string;
  readonly warnings: readonly string[];
  readonly lanes: readonly LaneReport[];
  readonly duration?: number;
  readonly loop?: boolean;
}

const loadBuild = async (file: string, flags: ParamFlags, sources = false): Promise<SvgBuild> => {
  const diagnosed: string[] = [];
  const lanes: LaneReport[] = [];

  startTrace({ within: sources && !file.endsWith(".svg") ? sceneDir(file) : undefined });

  try {
    const built = await loadBuilt(
      file,
      flags,
      (warning) => diagnosed.push(warning.message),
      (lane) => lanes.push(lane),
    );

    return {
      svg: built.svg,
      warnings: [...diagnosed, ...validateSvg(built.svg).warnings],
      lanes,
      ...(built.scene && { duration: built.scene.duration, loop: built.scene.loop }),
    };
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

  if (values.out) {
    await mkdir(dirname(resolve(values.out)), { recursive: true });
    await writeFile(values.out, built.svg);
  }

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

const loadOptional = async (name: string, command: string): Promise<object> => {
  const carried = host.module?.(name);

  if (carried) return carried;

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
    fail(`svjeez ${command} needs ${name}. Install it with \`npm i -D ${name}\`.`);

  return import(url);
};

const loadVideo = (): Promise<VideoModule> => loadOptional(VIDEO, "video");

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

  await mkdir(dirname(resolve(out)), { recursive: true });
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

  const carried = await host.skill?.();

  if (!values.install) {
    process.stdout.write(
      carried?.get("SKILL.md") ?? (await readFile(join(SKILL, "SKILL.md"), "utf8")),
    );

    return;
  }

  const target = resolve(values.dir, "svjeez");

  if (carried)
    for (const [path, text] of carried) {
      await mkdir(dirname(join(target, path)), { recursive: true });
      await writeFile(join(target, path), text);
    }
  else await cp(SKILL, target, { recursive: true, force: true });
  console.log(`installed the svjeez skill in ${relative(process.cwd(), target) || "."}`);
};

const CUES = 48;

const parseTimes = (flag: string, text: string): number[] =>
  text.split(",").map((time) => {
    const parsed = time.trim() === "" ? NaN : Number(time.trim());

    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : fail(`--${flag} needs seconds from 0, separated by commas, got "${text}".`);
  });

const thrownAt = (error: Error, file: string): Source | undefined => {
  const stack = error.stack ?? "";
  const folder = dirname(resolve(file));

  for (const line of stack.split("\n")) {
    const match = /\(?((?:file:\/\/)?[^\s()]+?):(\d+):(\d+)\)?\s*$/.exec(line);

    if (!match) continue;

    const path = match[1]!.startsWith("file://")
      ? fileURLToPath(match[1]!.replace(/\?.*$/, ""))
      : match[1]!;

    if (path.startsWith(folder) && !path.includes("node_modules"))
      return { file: path, line: Number(match[2]), column: Number(match[3]) };
  }

  return undefined;
};

const compileError = (error: Error, file: string): Problem => {
  const told = isSceneError(error) ? error : undefined;
  const source = told?.source ?? thrownAt(error, file);

  return {
    code: "compile-error",
    severity: "error",
    key: told?.key ?? "",
    ...(source && { source }),
    message: told?.problem ?? error.message,
    fix:
      told?.fix ??
      "Fix what the message names; the scene must build before anything else can be checked.",
  };
};

const RANKS: readonly Severity[] = ["error", "warning", "info"];

interface Report {
  readonly ok: boolean;
  readonly file: string;
  readonly scene?: { readonly size: Model.Vec; readonly duration: number; readonly loop: boolean };
  readonly problems: readonly Problem[];
  readonly lanes: readonly LaneReport[];
  readonly cost?: Cost;
  readonly measured?: { readonly duration: number; readonly times: readonly number[] };
  readonly frames?: ReturnType<typeof describe>["frames"];
  readonly timeline?: ReturnType<typeof describe>["timeline"];
}

const checkCommand = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      times: { type: "string", short: "t" },
      at: { type: "string" },
      json: { type: "boolean" },
      format: { type: "string" },
      "fail-on": { type: "string" },
      browser: { type: "boolean" },
      "color-scheme": { type: "string" },
      ...PARAM_OPTIONS,
    },
  });

  const format = values.format ?? (values.json ? "json" : "text");

  if (format !== "json" && format !== "text") fail(`--format is text or json, got "${format}".`);

  const failOn = values["fail-on"] ?? "error";

  if (failOn !== "error" && failOn !== "warning")
    fail(`--fail-on is error or warning, got "${failOn}".`);

  const asJson = format === "json";

  const file = positionals[0] ?? fail(USAGE);
  const scheme = parseScheme(values["color-scheme"]);
  const times = values.times === undefined ? undefined : parseTimes("times", values.times);
  const at = values.at === undefined ? undefined : parseTimes("at", values.at);
  const found: Problem[] = [];
  let model: Scene | undefined;
  let svgText: string | undefined;
  let lanes: readonly LaneReport[] = [];
  let cost: Cost | undefined;
  let measured: Report["measured"];

  startTrace({ within: file.endsWith(".svg") ? undefined : sceneDir(file), sources: true });

  try {
    const value = await loadValue(file, values, (message) => {
      throw new Error(message);
    });

    if (isScene(value)) {
      model = value;
      const examined = examine(value, times);

      found.push(...examined.problems);
      lanes = examined.lanes;
      cost = examined.cost;
      svgText = examined.svg;
    } else {
      svgText = value;
      cost = costOf(value);

      for (const warning of validateSvg(value).warnings)
        found.push({
          code: "compile-warning",
          severity: "warning",
          key: "",
          message: warning,
          fix: "Change what the warning names.",
        });
    }
  } catch (error) {
    found.push(compileError(error instanceof Error ? error : new Error(String(error)), file));
  } finally {
    stopTrace();
  }

  // Type errors first: a wrong type is often why the scene threw or looks wrong.
  if (host.check && !file.endsWith(".svg")) found.unshift(...(await host.check(resolve(file))));

  if (values.browser && svgText !== undefined) {
    const sources = model ? sourcesOf(model) : new Map<string, Source>();

    const cues = model
      ? momentsOf(model)
          .filter((t) => t < model!.duration)
          .filter((_, i, all) => all.length <= CUES || i % Math.ceil(all.length / CUES) === 0)
      : undefined;

    const pixels = await checkPixels(svgText, {
      ...(times ? { times } : cues && { cues }),
      colorScheme: scheme,
    });

    measured = { duration: pixels.duration, times: pixels.times };
    const said = new Set(found.map((f) => `${f.code} ${f.key}`));

    for (const browser of pixels.problems) {
      const source = sources.get(browser.key) ?? browser.source;
      const mapped = { ...browser, ...(source && { source }) };

      if (mapped.key === "" || !said.has(`${mapped.code} ${mapped.key}`)) found.push(mapped);
    }
  }

  const where = (source: Source | undefined): Source | undefined =>
    source && {
      ...source,
      file: source.file === "" ? file : relative(process.cwd(), source.file) || source.file,
    };

  const placed = found
    .map((f, index) => ({
      f: {
        ...f,
        ...(f.source && { source: where(f.source) }),
        ...(f.related && {
          related: f.related.map((r) => (r.source ? { ...r, source: where(r.source) } : r)),
        }),
      },
      index,
    }))
    .sort((a, b) => RANKS.indexOf(a.f.severity) - RANKS.indexOf(b.f.severity) || a.index - b.index)
    .map(({ f }) => f);

  const placedLanes = lanes.map((lane) => ({
    ...lane,
    ...(lane.source && { source: where(lane.source) }),
  }));

  const by = (severity: Severity) => placed.filter((f) => f.severity === severity);
  const described = model && at ? describe(model, at) : undefined;

  const report: Report = {
    ok: by("error").length === 0 && (failOn !== "warning" || by("warning").length === 0),
    file,
    ...(model && { scene: { size: model.size, duration: model.duration, loop: model.loop } }),
    problems: placed,
    lanes: placedLanes,
    ...(cost && { cost }),
    ...(measured && { measured }),
    ...(described && { frames: described.frames, timeline: described.timeline }),
  };

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    const place = (source: Source | undefined): string =>
      source
        ? `${source.file}:${source.line}${source.column === undefined ? "" : `:${source.column}`}`
        : file;

    for (const f of placed)
      console.log(`${place(f.source)}  ${f.code}  ${f.severity}: ${f.message}\n    fix: ${f.fix}`);

    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

    const shown = (t: number) => Number(t.toFixed(3));

    const how = measured
      ? `; loop ${shown(measured.duration)}s, measured at ${measured.times.length > 12 ? `${measured.times.length} times from ${shown(measured.times[0]!)}s to ${shown(measured.times.at(-1)!)}s` : measured.times.map(shown).join(", ")}`
      : "; model only";

    console.log(
      `${plural(by("error").length, "error")}, ${plural(by("warning").length, "warning")}, ${by("info").length} info${how}`,
    );

    if (cost) console.log(`cost: ${plural(cost.animations, "animation")}, ${cost.repaint} repaint`);

    if (model) {
      const names = namesOf(model);
      const smil = placedLanes.filter((lane) => lane.backend === "smil");

      console.log(`lanes: ${placedLanes.length - smil.length} css, ${smil.length} smil`);

      for (const lane of smil)
        console.log(
          `  smil  ${lane.lane} on ${names.get(lane.key) ?? `"${lane.key}"`}${lane.source ? `  ${lane.source.file}:${lane.source.line}` : ""}`,
        );
    }

    if (described) console.log(`\n${described.text}`);
    else if (at)
      console.log(
        found.some((f) => f.code === "compile-error")
          ? "\n--at describes the scene once it builds; fix the compile error above first."
          : "\n--at describes a scene model; this file is SVG, so there is nothing to describe.",
      );
  }

  if (!report.ok) process.exitCode = 1;
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
    command: host.self ?? [process.execPath, ...process.execArgv, self],
    args: paramArgs(values),
    files: values.params === undefined ? [] : [values.params],
    dirs: self.endsWith(".ts") ? [dirname(self)] : [],
    port,
    out: values.out,
  });
};

// The manifest sits beside cli.js in the published package, and one folder up from src/cli.ts.
const versionCommand = async (): Promise<void> => {
  if (host.version) return console.log(host.version);

  for (const at of ["./package.json", "../package.json"]) {
    const text = await readFile(new URL(at, import.meta.url), "utf8").catch(() => undefined);

    if (text !== undefined) return console.log(JSON.parse(text).version);
  }

  console.log("unknown");
};

const COMMANDS = new Map([
  ["svg", svgCommand],
  ["dev", devCommand],
  ["check", checkCommand],
  ["frames", framesCommand],
  ["video", videoCommand],
  ["skill", skillCommand],
  ["version", versionCommand],
  ...(host.commands ?? []),
]);

const [command = "", ...args] = process.argv.slice(2);
const HELP = new Set(["help", "--help", "-h"]);

if (HELP.has(command) || args.some((arg) => arg === "--help" || arg === "-h")) {
  console.log(USAGE);
  process.exit(0);
}

const run = COMMANDS.get(command) ?? (() => fail(USAGE));

await run(args).catch((error: Error) => fail(error.stack ?? error.message));
