import { plugin } from "bun";
import { join } from "node:path";

import { library } from "../scripts/library.ts";

const ROOT = join(import.meta.dir, "..");

const value = await library(
  join(ROOT, "dist/.test-library"),
  join(ROOT, "node_modules/.cache/fonts"),
);

// The build defines BUILD; src/ read directly needs it too.
Object.assign(globalThis, { BUILD: "test" });

plugin({
  name: "virtual:library",
  setup(build) {
    build.module("virtual:library", () => ({ exports: { default: value }, loader: "object" }));
  },
});
