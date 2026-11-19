import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import theme from "./theme.css?url";
import Card from "./Card.svelte";

const task = { id: 1, title: "Write tests", done: false };

export default await film(
  component(Card, { task }, { css: [theme] }),
  async ({ page, snap, update }) => {
    await snap("todo");
    await update({ task: { ...task, title: "Done it", done: true } });

    if ((await page.locator("#card").textContent())?.trim() !== "Done it")
      throw new Error("update did not re-render");

    if ((await page.locator("#card").getAttribute("data-done")) !== "true")
      throw new Error("update did not re-render");

    await snap("done", { over: 0.2 });
  },
  { onDiagnostics: () => {}, viewport: { width: 300, height: 100 } },
);
