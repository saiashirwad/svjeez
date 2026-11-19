// Type-level test, checked by `svelte-check` and never run: every `@ts-expect-error` must be an error.
// Plain `tsc` sees `.svelte` imports as untyped, so props are only checked by `svelte-check`.
import { component } from "@svjeez/dom/vite";
import type { Task } from "../dom-react/Task.ts";
import Card from "./Card.svelte";

declare const task: Task;

export const checks = async () => {
  await component(Card, { task });
  await component(Card, { task, onDone: () => {} });

  // @ts-expect-error a data prop is missing
  await component(Card, {});

  // @ts-expect-error `task` is a Task, not a string
  await component(Card, { task: "nope" });

  // @ts-expect-error not a prop of Card
  await component(Card, { task, nope: 1 });
};
