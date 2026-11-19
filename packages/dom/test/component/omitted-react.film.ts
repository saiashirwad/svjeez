import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Omitted from "./Omitted.tsx";

// `onDone` is omitted: the component calls it on mount and on click, and a page error fails the film.
export default await film(
  component(Omitted, { label: "go" }),
  async ({ page, snap }) => {
    await page.click("#omitted");
    await snap("clicked");
  },
  { onDiagnostics: () => {}, viewport: { width: 200, height: 80 } },
);
