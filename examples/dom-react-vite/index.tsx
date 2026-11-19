import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/vite";

export default await film(
  serve({ root: import.meta.dir, selector: "#app" }),
  async ({ page, snap }) => {
    await snap("start");

    await page.locator('[data-key="col-todo"] button').first().click();
    await snap("moved", { over: 0.7 });
  },
  {
    scheme: "both",
    title: "Sprint board (Vite)",
    viewport: { width: 760, height: 560 },
    cache: `${import.meta.dir}/states.json`,
  },
);
