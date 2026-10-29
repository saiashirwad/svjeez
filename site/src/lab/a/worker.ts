import { compileScene } from "@svjeez/live/compile";

// Compiles the edited scene with `sources`, so every element says which line made it.
self.onmessage = async ({ data }: MessageEvent<{ id: number; source: string }>) => {
  self.postMessage({ id: data.id, ...(await compileScene(data.source, { sources: true })) });
};
