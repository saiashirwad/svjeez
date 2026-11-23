import { expect, test } from "bun:test";
import { Effect } from "effect";
import { nextVersion, packageDirs, publishedRanges, sharedVersion } from "./package-manifest.ts";
import * as Services from "./services.ts";

const versions = new Map([["svjeez", "1.2.3"]]);

test("a workspace range is the caret of the package's version in dependencies, peer and optional alike", async () => {
  const manifest = {
    name: "@svjeez/x",
    version: "1.2.3",
    dependencies: { svjeez: "workspace:*", other: "^4.0.0" },
    peerDependencies: { svjeez: "workspace:^" },
    optionalDependencies: { svjeez: "workspace:*" },
  };

  expect(await Effect.runPromise(publishedRanges(manifest, versions))).toEqual({
    name: "@svjeez/x",
    version: "1.2.3",
    dependencies: { svjeez: "^1.2.3", other: "^4.0.0" },
    peerDependencies: { svjeez: "^1.2.3" },
    optionalDependencies: { svjeez: "^1.2.3" },
  });
});

test("a field the package does not have is not added, and a workspace range to nothing is an error", async () => {
  expect(await Effect.runPromise(publishedRanges({ name: "a", version: "1" }, versions))).toEqual({
    name: "a",
    version: "1",
  });

  expect(
    Effect.runPromise(
      publishedRanges(
        { name: "a", version: "1", peerDependencies: { nope: "workspace:*" } },
        versions,
      ),
    ),
  ).rejects.toThrow("nope");
});

test("every package shares one version", async () => {
  expect(
    await Effect.runPromise(
      packageDirs.pipe(Effect.flatMap(sharedVersion), Effect.provide(Services.layer)),
    ),
  ).toBeString();
});

test("next, minor and major bump to a prerelease, stable drops it, and anything else is an exact version", async () => {
  const bump = (current: string, to: string) => Effect.runPromise(nextVersion(current, to));

  expect(await bump("0.8.0-next.1", "next")).toBe("0.8.0-next.2");
  expect(await bump("0.7.1", "next")).toBe("0.7.2-next.0");
  expect(await bump("0.8.0-next.1", "minor")).toBe("0.9.0-next.0");
  expect(await bump("0.8.0-next.1", "major")).toBe("1.0.0-next.0");
  expect(await bump("0.8.0-next.1", "stable")).toBe("0.8.0");
  expect(await bump("0.8.0-next.1", "0.8.3")).toBe("0.8.3");
  expect(bump("0.8.0", "stable")).rejects.toThrow("already stable");
  expect(bump("0.8.0", "huge")).rejects.toThrow("huge");
});
