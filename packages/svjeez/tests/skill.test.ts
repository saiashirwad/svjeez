import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateSvg } from "svjeez/frames";
import { RULES, check, isScene, svg as backend, type Scene } from "svjeez/tools";

const root = join(import.meta.dir, "../skills/svjeez");
const examples = join(root, "examples");
const cli = join(import.meta.dir, "../src/cli.ts");

const modulesDir = join(root, "modules");
const packages = join(import.meta.dir, "../..");

const moduleFiles = readdirSync(modulesDir).filter((name) => name.endsWith(".md"));

const docs = ["SKILL.md", ...moduleFiles.map((name) => `modules/${name}`)];

const read = (file: string): string => readFileSync(join(root, file), "utf8");

const text = docs.map((file) => ({ file, source: read(file) }));

type Made = string | Scene | (() => string | Scene);

const isBuild = (value: Made): value is () => string | Scene => typeof value === "function";

const madeBy = (exported: Made): string | Scene => (isBuild(exported) ? exported() : exported);

const svgOf = (exported: Made): string => {
  const made = madeBy(exported);

  return isScene(made) ? backend.emit(made) : made;
};

const exampleFiles = readdirSync(examples).filter((name) => name.endsWith(".tsx"));

describe("skill examples", () => {
  for (const file of exampleFiles) {
    test(`${file} renders a valid, animated SVG`, async () => {
      const { default: exported }: { default: Made } = await import(join(examples, file));

      const svg = svgOf(exported);
      expect(validateSvg(svg).errors).toEqual([]);
      expect(svg).toContain("@keyframes");
    });

    test(`${file} passes check with no error and no warning`, async () => {
      const { default: exported }: { default: Made } = await import(join(examples, file));
      const made = madeBy(exported);

      if (!isScene(made)) throw new Error(`${file} does not export a scene.`);

      const found = check(made).problems.filter((problem) => problem.severity !== "info");
      expect(found.map((problem) => `${problem.code}: ${problem.message}`)).toEqual([]);
    });

    test(`${file} starts with the pragma and is self-contained`, () => {
      const source = readFileSync(join(examples, file), "utf8");
      expect(source.split("\n")[0]).toBe("/** @jsxImportSource svjeez */");

      const modules = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
      expect(modules.filter((name) => name !== "svjeez")).toEqual([]);
      expect(source.split("\n").length).toBeLessThanOrEqual(150);
    });
  }
});

const fences = (source: string): string[] =>
  [...source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]!);

// Modules that cannot be imported under bun test, so their names are not checked.
const UNIMPORTABLE = new Set<string>([]);

// Companion packages are not dependencies of svjeez, so resolve them from their own folder.
const locate = (from: string): string =>
  from.startsWith("@svjeez/") ? Bun.resolveSync(from, join(packages, from.split("/")[1]!)) : from;

const MODULES = /^(svjeez(\/(tools|frames|page))?|@svjeez\/[a-z]+(\/[a-z]+)?)$/;

describe("skill docs", () => {
  test("every relative link in the docs points to a file that exists", () => {
    const broken: string[] = [];
    let seen = 0;

    for (const { file, source } of text)
      for (const [, target] of source.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target!)) continue;
        seen++;

        const path = resolve(dirname(join(root, file)), target!.split("#")[0]!);

        if (!existsSync(path)) broken.push(`${file}: ${target}`);
      }

    expect(seen).toBeGreaterThanOrEqual(18);
    expect(broken).toEqual([]);
  });

  test("every bare examples/ or modules/ path the docs mention exists", () => {
    const missing = text.flatMap(({ file, source }) =>
      [...source.matchAll(/\b(?:examples|modules)\/[\w-]+\.\w+/g)].flatMap(([path]) =>
        existsSync(join(root, path)) ? [] : [`${file}: ${path}`],
      ),
    );

    expect(missing).toEqual([]);
  });

  test("every published companion package has a module doc that SKILL.md links to", () => {
    const names = readdirSync(packages)
      .flatMap((name) => {
        const manifest = join(packages, name, "package.json");

        if (name === "svjeez" || !existsSync(manifest)) return [];

        // SAFETY: every package.json in this repo is a JSON object; only `private` is read.
        const { private: hidden } = JSON.parse(readFileSync(manifest, "utf8")) as {
          private?: boolean;
        };

        return hidden ? [] : [name];
      })
      .sort();

    expect(names.length).toBeGreaterThanOrEqual(14);

    const skill = read("SKILL.md");
    const noDoc = names.filter((name) => !existsSync(join(modulesDir, `${name}.md`)));
    const unlinked = names.filter((name) => !skill.includes(`](modules/${name}.md)`));
    const stray = moduleFiles.filter((file) => !names.includes(file.replace(/\.md$/, "")));

    expect(noDoc).toEqual([]);
    expect(unlinked).toEqual([]);
    expect(stray).toEqual([]);
  });

  test("SKILL.md has frontmatter and stays concise", () => {
    const skill = read("SKILL.md");
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? "";

    expect(front).toMatch(/^name: svjeez$/m);
    expect(front).toMatch(/^description: \S/m);
    expect(skill.split("\n").length).toBeLessThanOrEqual(200);
  });

  test("every value export of svjeez appears in SKILL.md", async () => {
    const skill = read("SKILL.md");
    const names = Object.keys(await import("svjeez")).filter((name) => name !== "default");

    expect(names.length).toBeGreaterThan(40);

    const missing = names.filter(
      (name) =>
        !new RegExp(`\`[^\`\\n]*\\b${name}\\b[^\`\\n]*\``).test(skill) &&
        !skill.includes(`<${name}`),
    );

    expect(missing).toEqual([]);
  });

  test("every name imported in a code block is an export of its module", async () => {
    const modules = new Map<string, Set<string>>();

    for (const { file, source } of text)
      for (const block of fences(source))
        for (const [, kind, names, from] of block.matchAll(
          /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g,
        )) {
          if (kind || !MODULES.test(from!) || UNIMPORTABLE.has(from!)) continue;

          const wanted = names!
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && !name.startsWith("type "))
            .map((name) => name.split(/\s+as\s+/)[0]!);

          const exported = modules.get(from!) ?? new Set(Object.keys(await import(locate(from!))));

          modules.set(from!, exported);

          for (const name of wanted)
            expect(exported.has(name), `${file} imports ${name} from "${from}"`).toBe(true);
        }

    expect(modules.size).toBeGreaterThanOrEqual(10);
  });

  test("every check code is documented in SKILL.md, and only those", () => {
    const skill = /\n## Check rule codes\n([\s\S]*?)(?:\n## |$)/.exec(read("SKILL.md"))?.[1] ?? "";

    const codesOf = (section: string): string[] =>
      [...section.matchAll(/^\| ((?:`[a-z-]+`(?:, )?)+) \|/gm)].flatMap((match) =>
        [...match[1]!.matchAll(/`([a-z-]+)`/g)].map((code) => code[1]!),
      );

    const known = Object.keys(RULES).sort();
    expect(codesOf(skill).sort()).toEqual(known);
  });

  test("every svjeez command and flag in the docs is in the CLI usage, and every command is documented", () => {
    const usage = Bun.spawnSync([process.execPath, cli]).stderr.toString();
    expect(usage).toContain("usage:");

    const commands = [...usage.matchAll(/^ {2}svjeez (\w+)/gm)].map((match) => match[1]!);
    expect(commands.length).toBeGreaterThanOrEqual(6);

    const help = (...args: string[]): string =>
      Bun.spawnSync([process.execPath, cli, ...args]).stdout.toString();

    const everyHelp = [
      usage,
      help("--help"),
      ...commands.map((command) => help(command, "--help")),
    ].join("\n");

    // init and browser belong to the standalone binary (@svjeez/bin), not to this CLI.
    const skill = read("SKILL.md")
      .split("\n")
      .filter((line) => !line.includes("@svjeez/bin"))
      .join("\n");

    const cliText = skill.replaceAll("tsc --noEmit", "");

    const used = [...skill.matchAll(/`svjeez (\w+)/g)].map((match) => match[1]!);

    expect(used.filter((command) => !commands.includes(command))).toEqual([]);
    expect(commands.filter((command) => !skill.includes(`svjeez ${command}`))).toEqual([]);

    const flags = new Set(cliText.match(/(?<![\w-])--[a-zA-Z][\w-]*/g));
    const unknown = [...flags].filter((flag) => !new RegExp(`${flag}(?![\\w-])`).test(everyHelp));

    expect(unknown.filter((flag) => flag !== "--bun" && flag !== "--help")).toEqual([]);
  });

  test("names of removed APIs appear nowhere in the docs or examples", () => {
    const removed = [
      "motion(",
      "sampled.motion",
      "inspect(",
      "--no-browser",
      "svjeez/params",
      "polyline",
      "pathData",
      "symbol(",
      "<Instance",
      "<Image",
      "reducedMotion",
      "hint:",
      "DefaultLang",
      "grammars={",
    ];

    const everything = [
      ...text,
      ...exampleFiles.map((file) => ({
        file: `examples/${file}`,
        source: readFileSync(join(examples, file), "utf8"),
      })),
    ];

    const found = everything.flatMap(({ file, source }) =>
      removed.flatMap((name) => (source.includes(name) ? [`${file}: ${name}`] : [])),
    );

    expect(found).toEqual([]);
  });
});
