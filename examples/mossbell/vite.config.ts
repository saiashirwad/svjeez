import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const source = (file: string): string =>
  fileURLToPath(new URL(`../../packages/svjeez/src/${file}`, import.meta.url));

/** The game compiles its scenes in the page, so svjeez itself is bundled, straight from the library's source. */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: [
      {
        find: /^svjeez\/(jsx-runtime|jsx-dev-runtime|page|geometry)$/,
        replacement: source("$1.ts"),
      },
      { find: /^svjeez$/, replacement: source("index.ts") },
    ],
  },
});
