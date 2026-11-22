import { loadTypeGpu } from "svjeez/tools";

// Bun runs the first plugin that answers for a file, and TypeGPU's answers for every file it matches, so it is kept to the
// examples that have a "use gpu" function: the dom preload that comes after it answers for the rest.
await loadTypeGpu(import.meta.dir, {
  include: /\/examples\/(gpu-card|field-site|shader-site)\/(?!.*\/node_modules\/).*\.[cm]?[jt]sx?$/,
});
