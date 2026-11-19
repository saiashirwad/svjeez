import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/bun";
import index from "./index.html";

export default await film(
  serve(index),
  "#app",
  async ({ page, snap }) => {
    await snap("start");

    await page.locator('[data-key="col-todo"] button').first().click();
    await snap("moved", { over: 0.7 });

    await page.locator("input").pressSequentially("Write the docs", { delay: 15 });
    await page.getByRole("button", { name: "Add" }).click();
    await snap("added", { over: 0.7 });
  },
  {
    scheme: "both",
    title: "Sprint board",
    viewport: { width: 760, height: 560 },
    cache: `${import.meta.dir}/states.json`,
  },
);
