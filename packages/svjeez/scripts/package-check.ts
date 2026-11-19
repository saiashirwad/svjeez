import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BIN = join(ROOT, "node_modules/.bin");

const ENTRIES = [
  "svjeez",
  "svjeez/jsx-runtime",
  "svjeez/jsx-dev-runtime",
  "svjeez/tools",
  "svjeez/frames",
  "svjeez/page",
];

const CONSUMER = `import { Shape, circle, ease, enter, param, scene, span } from "svjeez";
import { svg as backend } from "svjeez/tools";
import { renderFrames } from "svjeez/frames";

export const speed = param.number(1, { min: 0, max: 4 });

// @ts-expect-error a circle's radius is a number
circle("2");
export const svg: string = backend.emit(scene({ size: [10, 10], duration: 1, title: "t" }, () => <Shape geometry={circle(2)} fill="#000000" motion={enter(span(0, 1), { from: { scale: 0 }, curve: ease.pop })} />));
export { renderFrames };
`;

const COMPILERS = [
  { name: "TypeScript 5.4", tsc: ["npx", "--yes", "--package", "typescript@5.4", "tsc"] },
  { name: "TypeScript latest", tsc: [join(BIN, "tsc")] },
] satisfies readonly { name: string; tsc: readonly [command: string, ...args: string[]] }[];

const RESOLUTIONS = [
  { moduleResolution: "node10", module: "commonjs", type: "commonjs" },
  { moduleResolution: "node16", module: "node16", type: "module" },
  { moduleResolution: "nodenext", module: "nodenext", type: "module" },
  { moduleResolution: "bundler", module: "esnext", type: "module" },
];

const run = (command: string, args: readonly string[], cwd = ROOT): string => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // SAFETY: execFileSync runs with encoding utf8, so the stdout and stderr on its error are strings when the command ran; the defaults cover a command that never started.
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    throw new Error(`${command} ${args.join(" ")}\n${stdout}${stderr}`);
  }
};

const dir = mkdtempSync(join(tmpdir(), "svjeez-package-"));
let failed = 0;

const check = (name: string, body: () => void) => {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : error}`);
  }
};

try {
  const tarball = join(
    dir,
    run("npm", ["pack", "--silent", "--pack-destination", dir]).trim().split("\n").at(-1)!,
  );

  check("publint", () => run(join(BIN, "publint"), ["--strict"]));
  check("arethetypeswrong", () =>
    run(join(BIN, "attw"), [tarball, "--ignore-rules", "cjs-resolves-to-esm"]),
  );

  const consumer = join(dir, "consumer");
  mkdirSync(join(consumer, "node_modules/svjeez"), { recursive: true });
  run("tar", [
    "-xzf",
    tarball,
    "-C",
    join(consumer, "node_modules/svjeez"),
    "--strip-components=1",
  ]);
  writeFileSync(join(consumer, "index.tsx"), CONSUMER);

  for (const {
    name,
    tsc: [command, ...args],
  } of COMPILERS) {
    const version = run(command, [...args, "--version"]).trim();

    for (const { moduleResolution, module, type } of RESOLUTIONS) {
      if (moduleResolution === "node10" && !version.startsWith("Version 5.")) continue;
      check(`${name} under ${moduleResolution}`, () => {
        writeFileSync(join(consumer, "package.json"), JSON.stringify({ type }));

        const compilerOptions = {
          module,
          moduleResolution,
          target: "es2022",
          lib: ["es2022", "dom"],
          types: [],
          jsx: "react-jsx",
          jsxImportSource: "svjeez",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        };

        writeFileSync(
          join(consumer, "tsconfig.json"),
          JSON.stringify({ compilerOptions, files: ["index.tsx"] }),
        );
        run(command, [...args, "-p", consumer]);
      });
    }
  }

  check("README quickstart on the packed CLI", () => {
    const quickstart = join(dir, "quickstart");
    mkdirSync(quickstart);
    const readme = readFileSync(join(consumer, "node_modules/svjeez/README.md"), "utf8");

    const block = (lang: string) => {
      const example = readme.split("```" + lang + "\n")[1]?.split("\n```")[0];

      if (!example) throw new Error(`Missing the README ${lang} quickstart block.`);

      return example;
    };

    run("npm", ["init", "-y"], quickstart);
    run("npm", ["pkg", "set", "type=module"], quickstart);
    run("npm", ["install", "--no-audit", "--no-fund", tarball], quickstart);
    run("npm", ["install", "--no-audit", "--no-fund", "-D", "tsx", "typescript"], quickstart);
    writeFileSync(join(quickstart, "tsconfig.json"), block("json"));
    const scene = block("tsx");
    const title = /title: "([^"]+)"/.exec(scene)?.[1];

    if (!title) throw new Error("The README tsx quickstart sets no scene title to check for.");

    writeFileSync(join(quickstart, "scene.tsx"), scene);
    run(join(quickstart, "node_modules/.bin/tsc"), ["--noEmit"], quickstart);
    run(
      process.execPath,
      ["node_modules/svjeez/package-dist/cli.js", "svg", "scene.tsx", "--out", "hello.svg"],
      quickstart,
    );

    if (!readFileSync(join(quickstart, "hello.svg"), "utf8").includes(`>${title}</title>`))
      throw new Error("The README scene did not render the expected SVG.");
  });

  for (const entry of ENTRIES) {
    check(`import and require ${entry}`, () => {
      run(
        process.execPath,
        ["--input-type=module", "-e", `await import(${JSON.stringify(entry)})`],
        consumer,
      );
      run(process.execPath, ["-e", `require(${JSON.stringify(entry)})`], consumer);
    });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`package checks ${failed === 0 ? "passed" : "failed"} on ${process.version}`);

if (failed > 0) process.exit(1);
