import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildReport } from "../src/svg/traced";

const cli = (...args: string[]) =>
  Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), ...args]);

const skill = readFileSync(join(import.meta.dir, "../skills/svjeez/SKILL.md"), "utf8");

test("svjeez skill prints the skill", () => {
  expect(cli("skill").stdout.toString()).toBe(skill);
});

test("svjeez skill --install copies the skill, its references and its examples, and can run again", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-skill-"));

  for (let run = 0; run < 2; run++)
    expect(cli("skill", "--install", "--dir", dir).exitCode).toBe(0);
  expect(readFileSync(join(dir, "svjeez/SKILL.md"), "utf8")).toBe(skill);

  for (const sub of ["examples", "references"]) {
    const shipped = readdirSync(join(import.meta.dir, "../skills/svjeez", sub)).sort();
    expect(shipped.length).toBeGreaterThan(0);
    expect(readdirSync(join(dir, "svjeez", sub)).sort()).toEqual(shipped);
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

test("svg --json reports compiled timing with the line that wrote each track", () => {
  const file = join(import.meta.dir, "fixtures/check/cue-scene.tsx");
  const output = cli("svg", file, "--json");

  expect(output.exitCode).toBe(0);
  const build: BuildReport & { svg: string } = JSON.parse(output.stdout.toString());

  const track = build.timeline.find((track) => track.label.endsWith(" · opacity"));
  expect(track?.source).toContain("cue-scene.tsx:10:");
  expect(track?.spans).toHaveLength(2);
  expect(track?.spans[0]?.at).toBeCloseTo(0.213);
  expect(track?.spans[1]?.at).toBeCloseTo(0.413);
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

  const build: BuildReport & { svg: string } = JSON.parse(
    cli("svg", file, "--json").stdout.toString(),
  );

  expect(build.svg).toContain(`data-key="1" data-source="${file}:`);
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
