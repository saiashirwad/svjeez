import { fileURLToPath } from "node:url";
import type { Framework } from "../framework.ts";

/** React: function components, `memo`, `forwardRef`. Detected by a `.tsx`/`.jsx` file or React's `$$typeof` tag. */
export const react: Framework = {
  name: "react",
  detect: (file, component) => /\.[jt]sx$/.test(file) || "$$typeof" in Object(component),
  client: fileURLToPath(new URL("./react.client.ts", import.meta.url)),
};
