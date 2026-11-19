import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Card from "./Card.tsx";

export default await film(
  component(Card, { title: "Ship it", done: false }),
  async ({ snap, update }) => {
    await snap("todo");
    await update({ done: true });
    await snap("done", { over: 0.4 });
  },
  { viewport: { width: 240, height: 80 }, onDiagnostics: () => {} },
);
