import { loadTypeGpu } from "svjeez/tools";

// Bun runs the first plugin that answers for a file, so TypeGPU's transform loads before the dom preload that answers for all.
await loadTypeGpu(import.meta.dir);
