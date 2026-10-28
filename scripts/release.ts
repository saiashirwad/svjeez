// Releases every package under packages/ whose version isn't out yet. A version is out once npm has it and GitHub has a
// release for it, so a rerun after a failure finishes the job without repeating the steps that worked.
//
//   bun scripts/release.ts plan       names the packages that have something to release
//   bun scripts/release.ts publish    releases them; release.yml runs this with npm's trusted publishing
//
// npm only takes a package from release.yml once the package's trusted publisher names it, so a new package needs one
// added on npmjs.com before its first release. npm allows that before the package exists.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
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

const run = (command: string, args: readonly string[], cwd = ROOT) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();

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

/** The versions npm has. The full document, because npm's cache can keep answering 404 for the abbreviated one after a package appears. */
const published = async (name: string): Promise<ReadonlySet<string>> => {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}`);

  if (response.status === 404) return new Set();
  if (!response.ok) throw new Error(`npm answered ${response.status} for ${name}`);

  return new Set(
    Object.keys(((await response.json()) as { versions: Record<string, unknown> }).versions),
  );
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
        const prerelease = version.includes("-");
        run("gh", [
          "release",
          "create",
          tag,
          tarball,
          "--target",
          process.env.GITHUB_SHA ?? run("git", ["rev-parse", "HEAD"]),
          "--title",
          `${name} ${version}`,
          "--generate-notes",
          ...(start ? ["--notes-start-tag", start] : []),
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

const [command] = process.argv.slice(2);
if (command === "plan") await plan();
else if (command === "publish") await publish();
else throw new Error("Usage: bun scripts/release.ts plan | publish");
