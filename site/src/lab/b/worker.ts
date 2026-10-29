import { compileBuild } from "@svjeez/live/compile";
import build, { type Feel } from "./scene";

self.onmessage = async ({ data }: MessageEvent<{ id: number; feel: Feel }>) => {
  self.postMessage({ id: data.id, ...(await compileBuild(() => build(data.feel))) });
};
