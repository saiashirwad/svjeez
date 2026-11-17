import { compileScene } from "./compile.ts";

self.onmessage = async ({
  data,
}: MessageEvent<{ id: number; source: string; sources?: boolean }>) => {
  self.postMessage({
    id: data.id,
    ...(await compileScene(data.source, { sources: data.sources })),
  });
};
