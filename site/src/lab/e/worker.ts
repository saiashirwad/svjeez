import { compileScene } from "../../playground/core";

self.onmessage = async ({ data }: MessageEvent<{ id: number; source: string }>) => {
  self.postMessage({ id: data.id, ...(await compileScene(data.source)) });
};
