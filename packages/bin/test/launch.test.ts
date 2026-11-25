import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { TARGETS } from "../scripts/binary.ts";
import { standIn, type StandIn } from "../scripts/release.ts";
import { assetFor, launch } from "../src/launch";

type Files = Readonly<Record<string, Uint8Array>>;

const encoder = new TextEncoder();

const executable = (record: string, status: number): Uint8Array =>
  encoder.encode(`#!/bin/sh\nprintf '%s\\n' "$@" > ${record}\nexit ${status}\n`);

const sumsOf = (files: Files): Uint8Array =>
  encoder.encode(
    `${Object.entries(files)
      .map(([name, bytes]) => `${createHash("sha256").update(bytes).digest("hex")}  ${name}`)
      .join("\n")}\n`,
  );

const inTemp = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-launch-"));

  try {
    await body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const serving = <A>(files: Files, body: (release: StandIn) => Promise<A>): Promise<A> =>
  Effect.runPromise(
    standIn(files).pipe(
      Effect.flatMap((release) => Effect.promise(() => body(release))),
      Effect.scoped,
    ),
  );

const given = (release: StandIn, cache: string) => ({
  version: "0.0.0-test",
  releases: release.url,
  cache,
  asset: "svjeez-test-x64",
});

test("the asset is named as the release names it, and Rosetta gets the arm64 build", () => {
  expect(assetFor("darwin", "arm64", false)).toBe("svjeez-darwin-arm64");
  expect(assetFor("darwin", "x64", false)).toBe("svjeez-darwin-x64");
  expect(assetFor("darwin", "x64", true)).toBe("svjeez-darwin-arm64");
  expect(assetFor("linux", "x64", true)).toBe("svjeez-linux-x64");
  expect(assetFor("win32", "x64", false)).toBe("svjeez-windows-x64.exe");
  expect(assetFor("freebsd", "x64", false)).toBeUndefined();
  expect(assetFor("linux", "riscv64", false)).toBeUndefined();
});

test("every target the build compiles is the asset a machine of that kind asks for", () => {
  for (const target of TARGETS) {
    const os = target.replace(/^bun-(\w+)-\w+$/, "$1").replace("windows", "win32");
    const arch = target.replace(/^bun-\w+-(\w+)$/, "$1");
    const compiled = `svjeez-${target.replace(/^bun-/, "")}${target.includes("windows") ? ".exe" : ""}`;

    expect(assetFor(os, arch, false)).toBe(compiled);
  }
});

test("the executable is downloaded once, checked against the checksums, and run with the arguments", async () => {
  await inTemp(async (dir) => {
    const record = join(dir, "ran");
    const files = { "svjeez-test-x64": executable(record, 7) };

    await serving({ ...files, "svjeez-checksums.txt": sumsOf(files) }, async (release) => {
      expect(
        await launch({ ...given(release, join(dir, "cache")), argv: ["check", "scene.tsx"] }),
      ).toBe(7);
      expect(readFileSync(record, "utf8")).toBe("check\nscene.tsx\n");

      expect(await launch({ ...given(release, join(dir, "cache")), argv: ["version"] })).toBe(7);
      expect(readFileSync(record, "utf8")).toBe("version\n");
      expect(release.asked()).toEqual([
        "/v0.0.0-test/svjeez-checksums.txt",
        "/v0.0.0-test/svjeez-test-x64",
      ]);
    });
  });
});

test("an executable that fails its checksum is not kept, and nothing runs", async () => {
  await inTemp(async (dir) => {
    const record = join(dir, "ran");

    const files = {
      "svjeez-test-x64": executable(record, 0),
      "svjeez-checksums.txt": encoder.encode(`${"0".repeat(64)}  svjeez-test-x64\n`),
    };

    await serving(files, async (release) => {
      expect(await launch({ ...given(release, join(dir, "cache")), argv: [] })).toBe(1);
      expect(existsSync(record)).toBe(false);
      expect(readdirSync(join(dir, "cache", "0.0.0-test"))).toEqual([]);
    });
  });
});

test("a release without the asset is reported, and nothing is kept", async () => {
  await inTemp(async (dir) => {
    await serving({ "svjeez-checksums.txt": encoder.encode("") }, async (release) => {
      expect(await launch({ ...given(release, join(dir, "cache")), argv: [] })).toBe(1);
      expect(existsSync(join(dir, "cache"))).toBe(false);
    });
  });
});
