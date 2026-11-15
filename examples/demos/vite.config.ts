import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The app's own Vite config. recordings() renders the demos through it, so they get the same React and Tailwind.
export default defineConfig({ plugins: [react(), tailwindcss()] });
