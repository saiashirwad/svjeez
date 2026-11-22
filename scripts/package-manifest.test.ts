import { expect, test } from "bun:test";
import { nextVersion, packageDirs, publishedRanges, sharedVersion } from "./package-manifest.ts";

const versions = new Map([["svjeez", "1.2.3"]]);

test("a workspace range is the caret of the package's version in dependencies, peer and optional alike", () => {
  const manifest = {
    name: "@svjeez/x",
    version: "1.2.3",
    dependencies: { svjeez: "workspace:*", other: "^4.0.0" },
    peerDependencies: { svjeez: "workspace:^" },
    optionalDependencies: { svjeez: "workspace:*" },
  };

  expect(publishedRanges(manifest, versions)).toEqual({
    name: "@svjeez/x",
    version: "1.2.3",
    dependencies: { svjeez: "^1.2.3", other: "^4.0.0" },
    peerDependencies: { svjeez: "^1.2.3" },
    optionalDependencies: { svjeez: "^1.2.3" },
  });
});

test("a field the package does not have is not added, and a workspace range to nothing is an error", () => {
  expect(publishedRanges({ name: "a", version: "1" }, versions)).toEqual({
    name: "a",
    version: "1",
  });

  expect(() =>
    publishedRanges(
      { name: "a", version: "1", peerDependencies: { nope: "workspace:*" } },
      versions,
    ),
  ).toThrow("nope");
});

test("every package shares one version", () => {
  expect(() => sharedVersion(packageDirs())).not.toThrow();
});

test("next, minor and major bump to a prerelease, stable drops it, and anything else is an exact version", () => {
  expect(nextVersion("0.8.0-next.1", "next")).toBe("0.8.0-next.2");
  expect(nextVersion("0.7.1", "next")).toBe("0.7.2-next.0");
  expect(nextVersion("0.8.0-next.1", "minor")).toBe("0.9.0-next.0");
  expect(nextVersion("0.8.0-next.1", "major")).toBe("1.0.0-next.0");
  expect(nextVersion("0.8.0-next.1", "stable")).toBe("0.8.0");
  expect(nextVersion("0.8.0-next.1", "0.8.3")).toBe("0.8.3");
  expect(() => nextVersion("0.8.0", "stable")).toThrow("already stable");
  expect(() => nextVersion("0.8.0", "huge")).toThrow("huge");
});
