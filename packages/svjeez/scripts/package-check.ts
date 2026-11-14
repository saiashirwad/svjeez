import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Checks the packed tarball the way users install it: lint the manifest, check type resolution, then type-check and load a consumer.
// CI runs it on Node 20 and 22 through tsx.
const ROOT = join(import.meta.dirname, "..");
const BIN = join(ROOT, "node_modules/.bin");

const ENTRIES = [
  "svjeez",
  "svjeez/extras",
  "svjeez/voxel",
  "svjeez/jsx-runtime",
  "svjeez/jsx-dev-runtime",
  "svjeez/frames",
  "svjeez/page",
  "svjeez/params",
];

// The @ts-expect-error fails the check if typed ids stop being checked, as they do when NoInfer is missing.
const CONSUMER = `import { ease, enter, render } from "svjeez";
import { flowchart } from "svjeez/extras";
import { renderFrames } from "svjeez/frames";

const chart = flowchart({ nodes: { a: "A", b: "B" }, edges: [["a", "b"]] });
// @ts-expect-error "c" is not a node id
chart.route("a", "c");
export const svg: string = render({ width: 10, height: 10, duration: 1, title: "t" }, <g animation={enter({ at: 0, over: 1 }, { scale: 0 }, ease.pop)}>{chart.node}</g>);
export { renderFrames };
`;

// TypeScript 5.4 is the oldest supported compiler, and the newest that still has node10.
const COMPILERS = [
  { name: "TypeScript 5.4", tsc: ["npx", "--yes", "--package", "typescript@5.4", "tsc"] },
  { name: "TypeScript latest", tsc: [join(BIN, "tsc")] },
];

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
    const version = run(command!, [...args, "--version"]).trim();

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
        run(command!, [...args, "-p", consumer]);
      });
    }
  }

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
