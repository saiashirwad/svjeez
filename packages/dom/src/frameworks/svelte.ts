import { fileURLToPath } from "node:url";
import type { Framework } from "../framework.ts";

/** Svelte 5: `.svelte` components. Needs Vite with `@sveltejs/vite-plugin-svelte`; Bun cannot bundle Svelte yet. */
export const svelte: Framework = {
  name: "svelte",
  detect: (file) => file.endsWith(".svelte"),
  client: fileURLToPath(new URL("./svelte.client.svelte.ts", import.meta.url)),
};
