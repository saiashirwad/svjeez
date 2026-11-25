import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Lists from "./Lists.tsx";

const rows = [
  { id: 1, text: "todo" },
  { id: 2, text: "todo" },
  { id: 3, text: "todo" },
];

export default await film(
  component(Lists, { left: rows, right: rows }),
  async ({ snap, update }) => {
    await snap("start");
    await update({ left: [rows[2]!, rows[0]!, rows[1]!], right: rows });
    await snap("sorted", { over: 1 });
  },
  { onDiagnostics: () => {}, viewport: { width: 300, height: 120 } },
);
