import { loadTypeGpu } from "svjeez/tools";

await loadTypeGpu(import.meta.dir, {
  include:
    /\/examples\/(?:gpu-card\/(?!.*\/node_modules\/).*\.[cm]?[jt]sx?|field-site\/scenes\/fields\.tsx)$/,
});
