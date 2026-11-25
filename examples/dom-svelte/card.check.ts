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
