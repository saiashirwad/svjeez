import { compileBuild } from "../../playground/core";
import { build } from "./build";
import type { Genome } from "./genome";

// Lab e ships its scene as code, so the worker draws the genome it is sent.
self.onmessage = async ({ data }: MessageEvent<{ id: number; genome: Genome }>) => {
  self.postMessage({ id: data.id, ...(await compileBuild(() => build(data.genome))) });
};
