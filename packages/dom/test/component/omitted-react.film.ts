import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Omitted from "./Omitted.tsx";

export default await film(
  component(Omitted, { label: "go" }),
  async ({ page, snap }) => {
    await page.click("#omitted");
    await snap("clicked");
  },
  { onDiagnostics: () => {}, viewport: { width: 200, height: 80 } },
);
