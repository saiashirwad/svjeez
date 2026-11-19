import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Card from "./Card.tsx";
import theme from "./theme.css?url";

const task = { id: 1, title: "Write tests", done: false };

export default await film(
  component(Card, { task, onDone: () => {} }, { css: [theme] }),
  async ({ page, snap, update }) => {
    await snap("todo");

    const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--bg"));

    if (bg.trim() !== "#fffbe6") throw new Error(`css was not loaded: "${bg}"`);

    await update({ note: "merged" });

    if ((await page.locator("#card").textContent()) !== "Write testsmerged")
      throw new Error("update did not merge");

    await update({ task: { ...task, done: true } });

    if ((await page.locator("#card").getAttribute("data-done")) !== "true")
      throw new Error("update did not re-render");

    if ((await page.locator("#card").textContent()) !== "Write testsmerged")
      throw new Error("update lost the note");

    await snap("done", { over: 0.2 });
  },
  { onDiagnostics: () => {}, viewport: { width: 300, height: 100 } },
);
