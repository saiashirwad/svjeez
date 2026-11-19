import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import { Named } from "./Card.tsx";

export default await film(component(Named, { label: "hi" }), async ({ snap, update }) => {
  await snap("a");
  // @ts-expect-error a Map is not JSON
  await update({ label: new Map() });
});
