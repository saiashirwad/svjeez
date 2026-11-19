import { film } from "../../src/index.ts";
import { serve } from "../../src/vite.ts";

export default await film(
  serve({ root: import.meta.dirname, selector: "#app" }),
  async ({ snap }) => {
    await snap("start");
  },
  {
    cache: process.env.CACHE_OPTION === "true" ? true : "cache-out/states.json",
    onDiagnostics: () => {},
  },
);
