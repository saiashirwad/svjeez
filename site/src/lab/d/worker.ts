import { compileBuild } from "@svjeez/live/compile";
import { build, type Frame } from "./scene";

self.onmessage = async ({ data }: MessageEvent<{ id: number; frame: Frame }>) => {
  self.postMessage({ id: data.id, ...(await compileBuild(() => build(data.frame))) });
};
