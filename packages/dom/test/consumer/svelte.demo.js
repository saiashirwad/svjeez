import { click, demo, snap } from "@svjeez/dom/svelte";
import Counter from "./Counter.svelte";

export const counter = demo(Counter, { width: 200 }, ({ props }) => [
  snap("zero"),
  click("add"),
  snap("one", { over: 0.2 }),
  props({ label: "Total" }),
  snap("renamed", { over: 0.2 }),
]);
