// Compiles scenes off the main thread. Request {id, source}; reply {id, ...Compiled}.
import { compileScene } from "@svjeez/live/compile";

self.onmessage = async ({ data }: MessageEvent<{ id: number; source: string }>) => {
  self.postMessage({ id: data.id, ...(await compileScene(data.source)) });
};
