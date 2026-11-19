import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import { Named } from "./Card.tsx";

// @ts-expect-error a Date is not JSON
export default await film(component(Named, { label: new Date() }), async () => {});
