import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The app's own Vite config. recordings() renders the demo through it, so the board gets the same React build.
export default defineConfig({ plugins: [react()] });
