import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import type { Task } from "../dom-react/Task.ts";
import theme from "../dom-react/theme.css?url";
import Card from "./Card.svelte";

const task: Task = {
  id: 1,
  title: "Sketch the board",
  note: "Two columns, soft shadows",
  done: false,
};

export default await film(
  component(Card, { task }, { css: [theme] }),
  async ({ snap, update }) => {
    await snap("todo");

    await update({ task: { ...task, note: "Wired up, waiting on review" } });
    await snap("note", { over: 0.5 });

    await update({ task: { ...task, note: "Wired up, waiting on review", done: true } });
    await snap("done", { over: 0.6 });
  },
  {
    scheme: "both",
    title: "Svelte card",
    viewport: { width: 520, height: 120 },
  },
);
