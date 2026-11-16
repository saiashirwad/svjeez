import { click, demo, snap } from "../../../src/svelte.ts";
import Counter from "./Counter.svelte";

export const counter = demo(Counter, { width: 200 }, ({ props }) => [
  snap("zero"),
  click("add"),
  snap("one", { over: 0.2 }),
  props({ label: "Total" }),
  snap("renamed", { over: 0.2 }),
]);
