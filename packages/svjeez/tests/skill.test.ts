import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateSvg } from "svjeez/frames";
import { RULES, check, isScene, svg as backend, type Scene } from "svjeez/tools";

const root = join(import.meta.dir, "../skills/svjeez");
const examples = join(root, "examples");
const cli = join(import.meta.dir, "../src/cli.ts");

const docs = [
  "SKILL.md",
  ...readdirSync(join(root, "references")).map((name) => `references/${name}`),
];

const read = (file: string): string => readFileSync(join(root, file), "utf8");

const text = docs.map((file) => ({ file, source: read(file) }));

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [join(dir, entry.name)]
        : [],
  );

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

    test(`${file} starts with the pragma and imports only svjeez and ./style`, () => {
      const source = readFileSync(join(examples, file), "utf8");
      expect(source.split("\n")[0]).toBe("/** @jsxImportSource svjeez */");

      const modules = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
      expect(modules.filter((name) => name !== "svjeez" && name !== "./style")).toEqual([]);
      expect(source.split("\n").length).toBeLessThanOrEqual(150);
    });
  }
});

const fences = (source: string): string[] =>
  [...source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]!);

const MODULES = /^(svjeez(\/(tools|frames|page))?|@svjeez\/[a-z]+(\/[a-z]+)?)$/;

describe("skill docs", () => {
  test("every examples/ and references/ path they mention exists", () => {
    const mentioned = docs.flatMap((file) =>
      [...read(file).matchAll(/\b(examples|references)\/([\w-]+\.[\w]+)/g)].map(
        ([, dir, name]) => `${dir}/${name}`,
      ),
    );

    expect(mentioned.length).toBeGreaterThan(10);
    expect(mentioned.filter((path) => !existsSync(join(root, path)))).toEqual([]);
  });

  test("every reference is routed from SKILL.md, and none runs past 100 lines", () => {
    const skill = read("SKILL.md");
    expect(docs.filter((file) => file !== "SKILL.md" && !skill.includes(file))).toEqual([]);
    expect(skill.split("\n").length).toBeLessThanOrEqual(260);

    expect(
      text.filter(({ file, source }) => file !== "SKILL.md" && source.split("\n").length > 100),
    ).toEqual([]);
  });

  test("every runtime error in the error table is thrown somewhere in src", () => {
    const section = /\nRuntime errors[^\n]*\n([\s\S]*?)\n## /.exec(read("SKILL.md"))?.[1] ?? "";

    const quoted = [...section.matchAll(/^\| (`+) ?(.+?) ?\1 \|/gm)].flatMap((match) =>
      match[2] === "Message" ? [] : [match[2]!],
    );

    expect(quoted.length).toBeGreaterThanOrEqual(25);

    const lines = sources(join(import.meta.dir, "../src")).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line) => line.replaceAll("\\`", "`")),
    );

    const missing = quoted.filter((message) => {
      const parts = message.split("…").filter(Boolean);

      return !lines.some((line) => parts.every((part) => line.includes(part)));
    });

    expect(missing).toEqual([]);
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
          if (kind || !MODULES.test(from!)) continue;

          const wanted = names!
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name !== "" && !name.startsWith("type "))
            .map((name) => name.split(/\s+as\s+/)[0]!);

          const exported = modules.get(from!) ?? new Set(Object.keys(await import(from!)));

          modules.set(from!, exported);

          for (const name of wanted)
            expect(exported.has(name), `${file} imports ${name} from "${from}"`).toBe(true);
        }

    expect(modules.size).toBeGreaterThan(8);
  });

  test("the scene in SKILL.md is examples/hello.tsx", () => {
    const section = read("SKILL.md").split("## What a scene is")[1]!;
    const [scene] = fences(section);
    expect(scene).toBeDefined();
    expect(scene!.trimEnd()).toBe(readFileSync(join(examples, "hello.tsx"), "utf8").trimEnd());
  });

  test("every check code is documented in SKILL.md and check.md, and only those", () => {
    const skill = /\n## Check, look, fix\n([\s\S]*?)\n## Size/.exec(read("SKILL.md"))?.[1] ?? "";
    const reference = /\n## Codes\n([\s\S]*?)\n## /.exec(read("references/check.md"))?.[1] ?? "";

    const codesOf = (section: string): string[] =>
      [...section.matchAll(/^\| ((?:`[a-z-]+`(?:, )?)+) \|/gm)].flatMap((match) =>
        [...match[1]!.matchAll(/`([a-z-]+)`/g)].map((code) => code[1]!),
      );

    const known = Object.keys(RULES).sort();
    expect(codesOf(skill).sort()).toEqual(known);
    expect(codesOf(reference).sort()).toEqual(known);
  });

  test("every svjeez command and flag in the docs is in the CLI usage, and every command is documented", () => {
    const usage = Bun.spawnSync([process.execPath, cli]).stderr.toString();
    expect(usage).toContain("usage:");

    const commands = [...usage.matchAll(/^ {2}svjeez (\w+)/gm)].map((match) => match[1]!);
    expect(commands.length).toBeGreaterThanOrEqual(6);

    const all = text.map(({ source }) => source).join("\n");

    // Mermaid's own arrows (--x, -->>) are not flags.
    const cliText = text
      .flatMap(({ file, source }) => (file === "references/mermaid.md" ? [] : [source]))
      .join("\n")
      .replaceAll("tsc --noEmit", "");

    const used = [...all.matchAll(/(?:npx|bunx(?: --bun)?) svjeez (\w+)/g)].map(
      (match) => match[1]!,
    );

    expect(used.filter((command) => !commands.includes(command))).toEqual([]);
    expect(commands.filter((command) => !all.includes(`svjeez ${command}`))).toEqual([]);

    const flags = new Set(cliText.match(/(?<![\w-])--[a-zA-Z][\w-]*/g));
    const unknown = [...flags].filter((flag) => !new RegExp(`${flag}(?![\\w-])`).test(usage));

    // --bun is bunx's own flag, which the docs show beside the CLI.
    expect(unknown.filter((flag) => flag !== "--bun")).toEqual([]);
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
