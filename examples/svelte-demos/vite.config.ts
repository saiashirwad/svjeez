import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The app's own Vite config. recordings() renders the demos through it, so they get the same Svelte and Tailwind.
export default defineConfig({ plugins: [svelte(), tailwindcss()] });
