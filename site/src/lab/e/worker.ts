import { compileBuild } from "@svjeez/live/compile";
import { build } from "./build";
import type { Genome } from "./genome";

self.onmessage = async ({ data }: MessageEvent<{ id: number; genome: Genome }>) => {
  self.postMessage({ id: data.id, ...(await compileBuild(() => build(data.genome))) });
};
