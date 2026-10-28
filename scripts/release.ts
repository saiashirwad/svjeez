// Releases every package under packages/ whose version isn't out yet. A version is out once npm has it and GitHub has a
// release for it, so a rerun after a failure finishes the job without repeating the steps that worked.
//
//   bun scripts/release.ts plan           names the packages that have something to release
//   bun scripts/release.ts publish        releases them; release.yml runs this with npm's trusted publishing
//   bun scripts/release.ts claim <dir>    a new package's first publish, from a maintainer's machine
//
// npm trusts a workflow one package at a time, and only for a package it already has. So a new package's first version
// goes out through `claim`, which publishes it with the maintainer's npm login and then trusts release.yml with the rest.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly repository?: { readonly url: string };
}

interface Package {
  readonly dir: string;
  /** The folder npm packs. A private workspace manifest isn't the one npm sees: build:package writes that into package-dist/. */
  readonly out: string;
  readonly manifest: Manifest;
}

interface Pending {
  readonly pkg: Package;
  readonly tag: string;
  readonly npm: boolean;
  readonly github: boolean;
}

const ROOT = join(import.meta.dirname, "..");
const WORKFLOW = "release.yml";
const ENVIRONMENT = "npm";

const run = (command: string, args: readonly string[], cwd = ROOT) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();

const warn = (message: string) =>
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : message);

const load = (dir: string): Package | undefined => {
  const manifest: Manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

  if (!manifest.private) return { dir, out: dir, manifest };

  if (manifest.scripts?.["build:package"]) return { dir, out: join(dir, "package-dist"), manifest };
};

/** Dependencies first, so a push that bumps @svjeez/vite and @svjeez/astro together publishes the vite that astro installs. */
const packages = (): Package[] => {
  const all = readdirSync(join(ROOT, "packages")).flatMap(
    (name) => load(join(ROOT, "packages", name)) ?? [],
  );

  const sorted: Package[] = [];

  const visit = (pkg: Package) => {
    if (sorted.includes(pkg)) return;

    for (const name of Object.keys(pkg.manifest.dependencies ?? {})) {
      const dependency = all.find((other) => other.manifest.name === name);

      if (dependency) visit(dependency);
    }

    sorted.push(pkg);
  };

  all.forEach(visit);

  return sorted;
};

/** svjeez keeps the v1.2.3 tags it has always had. Every other package tags name@version, as in @svjeez/vite@0.1.0. */
const tagFor = (name: string, version: string) =>
  name === "svjeez" ? `v${version}` : `${name}@${version}`;

/**
 * The versions npm has, or undefined when npm has never had the package. This reads the full document, because npm's
 * cache kept answering 404 for the abbreviated one after @svjeez/vite appeared.
 */
const published = async (name: string): Promise<ReadonlySet<string> | undefined> => {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}`);

  if (response.status === 404) return undefined;

  if (!response.ok) throw new Error(`npm answered ${response.status} for ${name}`);

  // SAFETY: a packument from the registry always has a versions object, keyed by version.
  const { versions } = (await response.json()) as { versions: object };

  return new Set(Object.keys(versions));
};

const releases = (): readonly string[] =>
  JSON.parse(run("gh", ["release", "list", "--limit", "1000", "--json", "tagName"])).map(
    (release: { tagName: string }) => release.tagName,
  );

const pending = async (): Promise<Pending[]> => {
  const tags = releases();
  const out: Pending[] = [];

  for (const pkg of packages()) {
    const { name, version } = pkg.manifest;
    const versions = await published(name);

    if (!versions) {
      warn(
        `${name} isn't on npm yet. Run \`bun scripts/release.ts claim ${relative(ROOT, pkg.dir)}\` once, and this workflow releases it after that.`,
      );
      continue;
    }

    const tag = tagFor(name, version);
    const step = { pkg, tag, npm: !versions.has(version), github: !tags.includes(tag) };

    if (step.npm || step.github) out.push(step);
  }

  return out;
};

/** This package's release before `version`, so the generated notes start there and not at another package's release. */
const previous = (name: string, version: string, tags: readonly string[]) => {
  const prefix = tagFor(name, "");

  const versions = tags.flatMap((tag) =>
    tag.startsWith(prefix) && /^\d+\.\d+\.\d+/.test(tag.slice(prefix.length))
      ? [tag.slice(prefix.length)]
      : [],
  );

  const earlier = versions
    .filter((other) => Bun.semver.order(other, version) < 0)
    .sort(Bun.semver.order);

  return earlier.length ? tagFor(name, earlier.at(-1)!) : undefined;
};

/**
 * The commits since `start` that touched this package. GitHub's generated notes list every pull request merged in that
 * range, so an @svjeez/astro release would also list svjeez and site changes.
 */
const notes = (pkg: Package, start: string | undefined, target: string) => {
  const range = start ? `${start}..${target}` : target;

  const log = run("git", [
    "log",
    "--no-merges",
    "--format=- %s (%h)",
    range,
    "--",
    relative(ROOT, pkg.dir),
  ]);

  return log || "No changes to this package.";
};

const distTag = (version: string) => (version.includes("-") ? "next" : "latest");

const plan = async () => {
  const names = (await pending()).map(({ pkg }) => pkg.manifest.name);
  console.log(names.length ? `To release: ${names.join(", ")}` : "Nothing to release");

  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `packages=${names.join(" ")}\n`);
};

const publish = async () => {
  const tmp = mkdtempSync(join(tmpdir(), "svjeez-release-"));

  try {
    const tags = releases();

    for (const { pkg, tag, npm, github } of await pending()) {
      const { name, version } = pkg.manifest;

      if (pkg.out !== pkg.dir) run("bun", ["run", "build:package"], pkg.dir);

      // npm pack runs prepack, which can print, so the tarball's name is the last line.
      const tarball = join(
        tmp,
        run("npm", ["pack", "--silent", "--pack-destination", tmp], pkg.out).split("\n").at(-1)!,
      );

      if (npm)
        run("npm", [
          "publish",
          tarball,
          "--provenance",
          "--access",
          "public",
          "--tag",
          distTag(version),
        ]);

      if (github) {
        const start = previous(name, version, tags);
        const target = process.env.GITHUB_SHA ?? run("git", ["rev-parse", "HEAD"]);
        const prerelease = version.includes("-");
        run("gh", [
          "release",
          "create",
          tag,
          tarball,
          "--target",
          target,
          "--title",
          `${name} ${version}`,
          "--notes",
          notes(pkg, start, target),
          // The repository's latest release stays svjeez's.
          `--latest=${name === "svjeez" && !prerelease}`,
          ...(prerelease ? ["--prerelease"] : []),
        ]);
      }

      console.log(`Released ${name} ${version}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

/**
 * Runs `npm publish` with its output and login prompts shown live. A version staged by an earlier claim is not on the
 * registry yet, so `published()` misses it and npm refuses the second publish. That refusal resolves to true.
 */
const stage = (args: readonly string[], cwd: string) =>
  new Promise<boolean>((done, fail) => {
    const child = spawn("npm", args, { cwd, stdio: ["inherit", "inherit", "pipe"] });
    let errors = "";

    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      errors += chunk;
    });
    child.on("error", fail);
    child.on("close", (code) => {
      if (code === 0) done(false);
      else if (errors.includes("previously staged version")) done(true);
      else fail(new Error(`npm ${args.join(" ")} exited with ${code}.`));
    });
  });

const claim = async (dir: string | undefined) => {
  if (!dir)
    throw new Error(
      "Name the package's folder, as in `bun scripts/release.ts claim packages/vite`.",
    );
  const pkg = load(resolve(dir));

  if (!pkg)
    throw new Error(`${dir} is private and has no build:package script, so it isn't released.`);
  const { name, version, repository } = pkg.manifest;
  const repo = repository && /github\.com[/:](.+?)(\.git)?$/.exec(repository.url)?.[1];

  if (!repo)
    throw new Error(
      `${name}'s package.json needs a GitHub repository.url, which npm checks the workflow against.`,
    );

  if (await published(name))
    console.log(`${name} is already on npm, so this only adds the trusted publisher.`);
  else {
    if (pkg.out !== pkg.dir) run("bun", ["run", "build:package"], pkg.dir);
    const staged = await stage(
      ["publish", "--access", "public", "--tag", distTag(version)],
      pkg.out,
    );

    console.log(
      staged
        ? `${name} ${version} is already staged from an earlier claim, so this only adds the trusted publisher.`
        : `npm stages a new package's first version.`,
      `Approve ${name} ${version} under Staged Packages on npmjs.com, or with \`npm stage approve\`.`,
    );
  }

  execFileSync(
    "npm",
    [
      "trust",
      "github",
      name,
      "--repo",
      repo,
      "--file",
      WORKFLOW,
      "--env",
      ENVIRONMENT,
      "--allow-publish",
      "--yes",
    ],
    { stdio: "inherit" },
  );
  console.log(
    `${WORKFLOW} can now publish ${name}. Its next run on main adds the GitHub release for ${version}.`,
  );
};

const [command, arg] = process.argv.slice(2);

if (command === "plan") await plan();
else if (command === "publish") await publish();
else if (command === "claim") await claim(arg);
else throw new Error("Usage: bun scripts/release.ts plan | publish | claim <dir>");
