import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LaneReport } from "svjeez/tools";

interface Build {
  readonly svg: string;
  readonly warnings: readonly string[];
  readonly lanes: readonly LaneReport[];
  readonly duration?: number;
  readonly loop?: boolean;
}

const cli = (...args: string[]) =>
  Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), ...args]);

const skill = readFileSync(join(import.meta.dir, "../skills/svjeez/SKILL.md"), "utf8");

test("svjeez skill prints the skill", () => {
  expect(cli("skill").stdout.toString()).toBe(skill);
});

test("svjeez skill --install copies the skill, its examples and its modules, and can run again", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-skill-"));

  for (let run = 0; run < 2; run++)
    expect(cli("skill", "--install", "--dir", dir).exitCode).toBe(0);
  expect(readFileSync(join(dir, "svjeez/SKILL.md"), "utf8")).toBe(skill);

  for (const folder of ["examples", "modules"]) {
    const shipped = readdirSync(join(import.meta.dir, "../skills/svjeez", folder)).sort();
    expect(shipped.length).toBeGreaterThan(0);
    expect(readdirSync(join(dir, "svjeez", folder)).sort()).toEqual(shipped);
  }
});

test("--help and -h print usage for every command and the bare CLI, and exit 0", () => {
  const commands = ["svg", "dev", "frames", "check", "perf", "video", "skill"];

  for (const args of [
    ["--help"],
    ["-h"],
    ...commands.flatMap((c) => [
      [c, "--help"],
      [c, "-h"],
    ]),
  ]) {
    const result = cli(...args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("usage:");
  }
});

test("svjeez frames rejects an unknown --color-scheme before launching a browser", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-frames-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
  const result = cli("frames", file, "--color-scheme", "sepia");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    '--color-scheme is system, light or dark, got "sepia".',
  );
});

test("svjeez video names the package to install when @svjeez/video is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-video-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  const result = Bun.spawnSync(
    [process.execPath, "--no-install", join(import.meta.dir, "../src/cli.ts"), "video", file],
    { cwd: dir },
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    "svjeez video needs @svjeez/video. Install it with `npm i -D @svjeez/video`.",
  );
});

test("svjeez video rejects a --format that contradicts --out", () => {
  const result = cli("video", "scene.svg", "--out", "scene.mp4", "--format", "webm");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("--format webm doesn't match --out scene.mp4.");
});

/** A stand-in @svjeez/video that writes the options it got as the file's bytes. */
const videoOptions = (...flags: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-preview-"));
  const module = join(dir, "node_modules/@svjeez/video");
  mkdirSync(module, { recursive: true });
  writeFileSync(
    join(module, "package.json"),
    '{"name":"@svjeez/video","version":"0.0.0","main":"index.js"}',
  );
  writeFileSync(
    join(module, "index.js"),
    "exports.video = async (svg, o) => ({ bytes: new TextEncoder().encode(JSON.stringify(o)), codec: 'x', frames: 1, playTime: 1, colorScheme: 'light' });",
  );
  writeFileSync(join(dir, "package.json"), "{}");

  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  const out = join(dir, "out.mp4");

  const result = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "../src/cli.ts"),
      "video",
      file,
      "--out",
      out,
      ...flags,
    ],
    { cwd: dir },
  );

  expect(result.exitCode).toBe(0);

  return JSON.parse(readFileSync(out, "utf8"));
};

test("svjeez video --preview defaults fps 12, scale 1 and quality low", () => {
  const options = videoOptions("--preview");
  expect(options).toMatchObject({ fps: 12, scale: 1, quality: "low" });
  expect(videoOptions().fps).toBeUndefined();
});

test("svjeez video --fps, --scale and --quality win over --preview", () => {
  const options = videoOptions("--preview", "--fps", "30", "--scale", "2", "--quality", "high");
  expect(options).toMatchObject({ fps: 30, scale: 2, quality: "high" });
});

test("svjeez render is no longer a command", () => {
  const result = cli("render", "scene.svg");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("svjeez frames <file>");
});

const TEMPLATE = `export const params = {
  title: { kind: "text", value: "Hello", maxLength: 12 },
  size: { kind: "number", value: 10, min: 1, max: 40, step: 1 },
  items: { kind: "list", item: { kind: "text", value: "" }, value: ["a"], min: 0 },
};
export default (p) =>
  \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="\${p.size}" height="10"><title>\${p.title}</title><desc>\${p.items.join(",")}</desc></svg>\`;
`;

const template = (source = TEMPLATE) => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-params-"));
  const file = join(dir, "scene.ts");
  writeFileSync(file, source);

  return { dir, file };
};

test("svjeez svg calls a template with its defaults, then with --params and --param over them", () => {
  const { dir, file } = template();
  expect(cli("svg", file).stdout.toString()).toContain("<title>Hello</title><desc>a</desc>");

  const data = join(dir, "data.json");
  writeFileSync(data, JSON.stringify({ title: "From file", items: ["x", "y"] }));
  const out = cli("svg", file, "--params", data, "--param", "size=20", "--param", "title=Flag");
  expect(out.stderr.toString()).toBe("");
  expect(out.stdout.toString()).toContain(
    'width="20" height="10"><title>Flag</title><desc>x,y</desc>',
  );
});

test("svg --json reports every animated lane with the line that wrote it", () => {
  const file = join(import.meta.dir, "fixtures/check/cue-scene.tsx");
  const output = cli("svg", file, "--json");

  expect(output.exitCode).toBe(0);
  const build: Build = JSON.parse(output.stdout.toString());

  const track = build.lanes.find((lane) => lane.lane === "opacity");
  expect(track?.source?.file).toContain("cue-scene.tsx");
  expect(track?.source?.line).toBe(11);
  expect(track?.backend).toBe("css");
  expect(track?.spans).toHaveLength(2);
  expect(track?.spans[0]?.start).toBeCloseTo(0.213);
  expect(track?.spans[1]?.start).toBeCloseTo(0.413);
  expect(build.warnings).toEqual([]);
});

test("svjeez svg says what is wrong with a param, naming its path", () => {
  const { dir, file } = template();
  const data = join(dir, "data.json");

  const fails = (args: string[], message: string) => {
    const result = cli("svg", file, ...args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(message);
  };

  writeFileSync(data, JSON.stringify({ items: ["x", 2] }));
  fails(["--params", data], "scene.ts: items[1] needs text, got 2.");
  fails(["--param", "size=99"], "size needs a number from 1 to 40, got 99.");
  fails(["--param", "size=big"], 'size needs a number from 1 to 40, got "big".');
  fails(
    ["--param", "colour=red"],
    '"colour" is not a param of this scene. It declares title, size, items.',
  );
  fails(
    ["--param", "items=x"],
    "--param items is a list. Put lists in a JSON file and pass it with --params.",
  );
  fails(["--param", "title"], '--param needs key=value, got "title".');
  fails(["--params", join(dir, "missing.json")], "no such file");
  writeFileSync(data, "{ nope");
  fails(["--params", data], "is not JSON");
});

test("svjeez svg emits a scene model default export, and --json reports its build", async () => {
  const file = join(import.meta.dir, "fixtures/scene/model.tsx");
  const { default: model } = await import(file);
  const { svg } = await import("svjeez/tools");
  const out = cli("svg", file);

  expect(out.stderr.toString()).toBe("");
  expect(out.stdout.toString()).toBe(svg.emit(model));

  const build: Build = JSON.parse(cli("svg", file, "--json").stdout.toString());

  expect(build.svg).toContain(`data-key="#1" data-source="${file}:`);
  expect(build.svg.replace(/ data-(key|source)="[^"]*"/g, "")).toBe(out.stdout.toString());
  expect(build).toMatchObject({ duration: 2, loop: true, warnings: [] });
});

test("svjeez svg calls a function that returns a scene model with its params", () => {
  const file = join(import.meta.dir, "fixtures/scene/template.tsx");

  expect(cli("svg", file).stdout.toString()).toContain('r="10"');
  const out = cli("svg", file, "--param", "title=Big", "--param", "radius=20");
  expect(out.stderr.toString()).toBe("");
  expect(out.stdout.toString()).toContain(">Big</title>");
  expect(out.stdout.toString()).toContain('r="20"');
});

test("svjeez svg says what a default export must be", () => {
  const { file } = template("export default 42;\n");
  const result = cli("svg", file);

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("must export default a scene");
});

test("svjeez svg with --params on a scene that declares none says so", () => {
  const { file } = template(
    "export default () => '<svg xmlns=\"http://www.w3.org/2000/svg\"/>';\n",
  );

  const result = cli("svg", file, "--param", "title=Hi");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    "has no `export const params` schema, so --params and --param have nothing to fill.",
  );
});

test("svjeez dev serves the scene with its params and rebuilds it when the scene or the data changes", async () => {
  const { dir, file } = template();
  const data = join(dir, "data.json");
  writeFileSync(data, JSON.stringify({ title: "One" }));

  const server = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "../src/cli.ts"),
      "dev",
      file,
      "--port",
      "0",
      "--params",
      data,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  try {
    const reader = server.stdout.getReader();
    let printed = "";

    while (!/at (http:\S+)/.test(printed)) {
      const { value, done } = await reader.read();

      if (done) throw new Error(`dev ended: ${printed}${await new Response(server.stderr).text()}`);
      printed += new TextDecoder().decode(value);
    }

    const url = /at (http:\S+)/.exec(printed)![1]!;
    const svg = () => fetch(`${url}/svg`).then((r) => r.text());

    const state = (): Promise<{ version: number; error?: string }> =>
      fetch(`${url}/state`).then((r) => r.json());

    const until = async (version: number) => {
      for (let i = 0; i < 100 && (await state()).version < version; i++) await Bun.sleep(50);

      return state();
    };

    expect(await svg()).toContain("<title>One</title>");
    expect(await (await fetch(url)).text()).toContain(
      'id="scrub" aria-label="Scene time" type="range"',
    );

    writeFileSync(data, JSON.stringify({ title: "Two" }));
    expect((await until(2)).error).toBeUndefined();
    expect(await svg()).toContain("<title>Two</title>");

    writeFileSync(
      file,
      TEMPLATE.replace(
        "export default (p) =>",
        "export default () => {\n  throw new Error('boom');\n};\nexport const old = (p) =>",
      ),
    );
    expect((await until(3)).error).toContain("boom");
  } finally {
    server.kill();
  }
}, 20_000);

test("svjeez --help prints usage and exits 0, on its own or after a command", () => {
  for (const args of [["--help"], ["frames", "--help"]]) {
    const { exitCode, stdout } = cli(...args);

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("usage:");
  }
});

test("svjeez names an unknown flag and prints the usage, with no stack trace", () => {
  const { exitCode, stderr } = cli("svg", "scene.tsx", "--nope");
  const err = stderr.toString();

  expect(exitCode).toBe(1);
  expect(err).toStartWith("svjeez svg: Unknown option '--nope'");
  expect(err).toContain("usage:");
  expect(err).not.toContain("    at ");
});

const ONCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100" height="60" role="img" aria-labelledby="t">
  <title id="t">c</title>
  <style><![CDATA[
.a{animation-duration:5s;animation-iteration-count:1;animation-fill-mode:both;animation-timing-function:cubic-bezier(.23,1,.32,1);animation-delay:var(--t0,0s)}
@keyframes k1{0%{translate:15px 35px}100%{translate:95px 35px}}
.m1{animation-name:k1;animation-timing-function:linear}
@media (prefers-reduced-motion:reduce){.a{animation-delay:-4.25s!important;animation-play-state:paused!important}}
]]></style>
  <circle r="5" fill="#000000" class="a m1"/>
</svg>`;

test("svjeez frames samples a scene that plays once to its end and clears the frames an earlier run wrote", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-once-"));
  const file = join(dir, "once.svg");
  const out = join(dir, "out");
  writeFileSync(file, ONCE);
  mkdirSync(out);

  for (const stale of ["frame-09-9_000s.png", "sheet.png"]) writeFileSync(join(out, stale), "old");
  writeFileSync(join(out, "notes.txt"), "keep");
  const result = cli("frames", file, "--out", out, "--count", "3");

  if (result.exitCode !== 0 && /Chromium|playwright-core/.test(result.stderr.toString())) return;
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("plays once, 5s");
  expect(result.stdout.toString()).not.toContain("loop 5s");

  expect(readdirSync(out).sort()).toEqual([
    "frame-00-0_000s.png",
    "frame-01-2_500s.png",
    "frame-02-5_000s.png",
    "notes.txt",
  ]);
});

test("frames and check --browser sample the scene's duration, not the shorter period of its tracks", () => {
  const scene = join(import.meta.dir, "fixtures/check/short-loop-scene.tsx");
  const dir = mkdtempSync(join(tmpdir(), "svjeez-period-"));
  const result = cli("frames", scene, "--out", dir, "--count", "4");

  if (result.exitCode !== 0 && /Chromium|playwright-core/.test(result.stderr.toString())) return;
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("loop 8s");
  expect(readdirSync(dir).sort()).toEqual([
    "frame-00-0_000s.png",
    "frame-01-2_000s.png",
    "frame-02-4_000s.png",
    "frame-03-6_000s.png",
  ]);

  const checked = cli("check", scene, "--browser");
  expect(checked.stdout.toString()).toContain("loop 8s");
}, 60_000);

test("svjeez check reports type errors in the scene with file:line, using the project's tsconfig", () => {
  const dir = mkdtempSync(join(import.meta.dir, "tmp-types-"));

  try {
    const file = join(dir, "scene.tsx");

    writeFileSync(
      file,
      [
        'import { Shape, circle, scene } from "svjeez";',
        "",
        'export const wrong: number = "text";',
        "",
        'export default scene({ size: [10, 10], duration: 1, loop: false, title: "t", desc: "d" }, () => (',
        '  <Shape geometry={circle(2)} fill="#fff" />',
        "));",
        "",
      ].join("\n"),
    );

    const result = cli("check", file);

    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toContain("scene.tsx:3:14  type-error  error: TS2322");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

test("svjeez check includes ambient declarations from the project's tsconfig", () => {
  const dir = mkdtempSync(join(import.meta.dir, "tmp-ambient-"));

  try {
    const file = join(dir, "scene.tsx");

    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        extends: "../../tsconfig.json",
        files: ["scene.tsx", "ambient.d.ts"],
      }),
    );
    writeFileSync(
      join(dir, "ambient.d.ts"),
      'declare module "ambient" { export type Size = number; }',
    );
    writeFileSync(
      file,
      [
        'import type { Size } from "ambient";',
        'import { Shape, circle, scene } from "svjeez";',
        "const radius: Size = 2;",
        'export default scene({ size: [10, 10], duration: 1, loop: false, title: "t", desc: "d" }, () => (',
        '  <Shape geometry={circle(radius)} fill="#fff" />',
        "));",
      ].join("\n"),
    );

    const result = cli("check", file);

    expect(result.stdout.toString()).not.toContain("TS2307");
    expect(result.exitCode).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

const markers = join(import.meta.dir, "fixtures/check/markers.tsx");

test("svjeez check --at takes marker names mixed with numbers", () => {
  const out = cli("check", markers, "--at", "handoff,2,outro").stdout.toString();
  expect(out).toContain("at 1.5s:");
  expect(out).toContain("at 2s:");
  expect(out).toContain("at 3s:");
});

test("svjeez check --at with an unknown marker lists the scene's markers", () => {
  const result = cli("check", markers, "--at", "handof");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    '--at has "handof", which is neither a number nor a marker of the scene. Known markers: handoff, outro.',
  );
});

test("svjeez check --times with an unknown marker is an error too", () => {
  const result = cli("check", markers, "--times", "nope,1");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('--times has "nope"');
});

const tiny = () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-perf-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  return file;
};

test("svjeez perf rejects bad flags before launching a browser", () => {
  const file = tiny();

  const cases: [string[], string][] = [
    [["--ms", "0"], "--ms needs a positive number of milliseconds, got 0."],
    [["--ms", "fast"], '--ms needs a number, got "fast".'],
    [["--windows", "1.5"], "--windows needs a positive whole number, got 1.5."],
    [["--windows", "0"], "--windows needs a positive whole number, got 0."],
    [["--fail-under=-3"], "--fail-under needs a positive fps, got -3."],
    [["--color-scheme", "sepia"], '--color-scheme is system, light or dark, got "sepia".'],
  ];

  for (const [flags, message] of cases) {
    const result = cli("perf", file, ...flags);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(message);
  }

  expect(cli("perf").exitCode).toBe(1);
});
