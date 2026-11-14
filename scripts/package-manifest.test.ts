import { expect, test } from "bun:test";
import { publishedRanges } from "./package-manifest.ts";

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
