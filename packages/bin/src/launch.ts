import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { constants } from "node:os";
import { dirname, join } from "node:path";

const OS = new Map([
  ["darwin", "darwin"],
  ["linux", "linux"],
  ["win32", "windows"],
]);

const ARCH = new Map([
  ["arm64", "arm64"],
  ["x64", "x64"],
]);

const exists = (file: string): Promise<boolean> =>
  stat(file).then(
    () => true,
    () => false,
  );

/** The release's asset for a machine, as scripts/build.ts names it. Under Rosetta the arm64 build is the faster one. */
export const assetFor = (
  platform: string,
  arch: string,
  translated: boolean,
): string | undefined => {
  const os = OS.get(platform);
  const cpu = ARCH.get(platform === "darwin" && arch === "x64" && translated ? "arm64" : arch);

  return os && cpu ? `svjeez-${os}-${cpu}${os === "windows" ? ".exe" : ""}` : undefined;
};

/** What the url serves, or nothing when it can't be reached or answers anything but 200. */
const get = async (url: string): Promise<Response | undefined> => {
  const response = await fetch(url).catch((error: Error) => {
    console.error(`svjeez: could not reach ${url}: ${error.message}`);

    return undefined;
  });

  if (response === undefined) return undefined;

  if (!response.ok) console.error(`svjeez: ${url} answered ${response.status}.`);

  return response.ok ? response : undefined;
};

const download = async (given: Given, file: string): Promise<boolean> => {
  const base = `${given.releases}/v${given.version}`;
  const sums = await get(`${base}/svjeez-checksums.txt`);
  const body = sums && (await get(`${base}/${given.asset}`))?.body;

  if (!sums || !body) return false;

  const expected = (await sums.text())
    .split("\n")
    .find((line) => line.endsWith(` ${given.asset}`))
    ?.split(" ")[0];

  const staging = `${file}.${process.pid}.tmp`;
  const hash = createHash("sha256");
  const reader = body.getReader();

  console.error(`downloading svjeez ${given.version} (${given.asset})`);

  await mkdir(dirname(file), { recursive: true });

  const out = await open(staging, "w", 0o755);

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      hash.update(chunk.value);
      await out.write(chunk.value);
    }

    if (hash.digest("hex") !== expected) {
      console.error(
        `svjeez: ${given.asset} doesn't match its checksum in v${given.version}, so it was not kept.`,
      );

      return false;
    }

    await rename(staging, file).catch(async (error: NodeJS.ErrnoException) => {
      if (!(await exists(file))) throw error;
    });

    return true;
  } finally {
    await out.close();
    await rm(staging, { force: true });
  }
};

export interface Given {
  /** The version this launcher was bundled beside: its GitHub release, v<version>, holds the executables. */
  readonly version: string;
  /** Where the release downloads live: <releases>/v<version>/<asset>. */
  readonly releases: string;
  /** The folder the executables are kept in, one folder per version. */
  readonly cache: string;
  /** The executable's name in the release. */
  readonly asset: string;
  readonly argv: readonly string[];
}

/** Runs the executable with argv, downloading it when the cache doesn't have it. Its exit status, or 1. */
export const launch = async (given: Given): Promise<number> => {
  const file = join(given.cache, given.version, given.asset);

  if (!(await exists(file)) && !(await download(given, file))) return 1;

  const child = spawn(file, [...given.argv], { stdio: "inherit" });
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

  const forward = (signal: NodeJS.Signals): void => void child.kill(signal);

  for (const signal of signals) process.on(signal, forward);

  try {
    return await new Promise<number>((resolve) => {
      child.on("error", (error) => {
        console.error(
          `svjeez: could not run ${file}: ${error.message}. Delete it to download it again.`,
        );

        resolve(1);
      });

      child.on("exit", (code, signal) =>
        resolve(code ?? (signal === null ? 1 : 128 + constants.signals[signal])),
      );
    });
  } finally {
    for (const signal of signals) process.off(signal, forward);
  }
};
