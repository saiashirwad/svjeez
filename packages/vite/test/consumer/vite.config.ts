import svjeez from "@svjeez/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [svjeez({ posters: { scale: 0.5 } })] });
