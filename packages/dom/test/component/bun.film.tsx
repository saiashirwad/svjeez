/** @jsxImportSource react */
import { film } from "../../src/index.ts";
import { component } from "../../src/bun.ts";
import Card from "./Card.tsx";
import theme from "./theme.css" with { type: "file" };

const task = { id: 1, title: "Write tests", done: false };

export default await film(
  component(Card, { task, onDone: () => {} }, { css: [theme] }),
  async ({ page, snap, update }) => {
    await snap("todo");

    const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--bg"));

    if (bg.trim() !== "#fffbe6") throw new Error(`css was not loaded: "${bg}"`);

    await update({ task: { ...task, done: true }, note: "merged" });

    if ((await page.locator("#card").getAttribute("data-done")) !== "true")
      throw new Error("update did not re-render");

    await snap("done", { over: 0.2 });
  },
  { onDiagnostics: () => {}, viewport: { width: 300, height: 100 } },
);
