// Compiles scene source off the main thread. Request {id, source, sources?}; reply {id, ...Compiled}.
import { compileScene } from "./compile";

self.onmessage = async ({
  data,
}: MessageEvent<{ id: number; source: string; sources?: boolean }>) => {
  self.postMessage({
    id: data.id,
    ...(await compileScene(data.source, { sources: data.sources })),
  });
};
