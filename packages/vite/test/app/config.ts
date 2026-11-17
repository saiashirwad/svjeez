import react from "@vitejs/plugin-react";
import { defaultServerConditions, type InlineConfig } from "vite";
import svjeez from "../../src/index.ts";

export const appConfig = (root = import.meta.dirname): InlineConfig => ({
  root,
  configFile: false,
  logLevel: "warn",
  plugins: [react(), svjeez({ posters: { scale: 0.5 } })],
  ssr: { resolve: { conditions: ["@svjeez/source", ...defaultServerConditions] } },
  server: { fs: { allow: [`${import.meta.dirname}/../../..`] } },
});
