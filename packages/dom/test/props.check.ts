// Type-level tests, checked by `tsc` and never run: every `@ts-expect-error` must be an error.
import type { Component } from "svelte";
import { film } from "../src/index.ts";
import { component } from "../src/vite.ts";
import Card from "./component/Card.tsx";

const task = { id: 1, title: "t", done: false };

declare const Typed: Component<{
  task: { id: number; title: string };
  when: string;
  onPick: (id: number) => void;
}>;

export const checks = async () => {
  // Data props are required; function props are optional.
  await component(Card, { task });
  await component(Card, { task, onDone: () => {}, note: "n" });
  await component(Typed, { task, when: "now" });

  // @ts-expect-error a data prop is missing
  await component(Card, { onDone: () => {} });

  // @ts-expect-error a Date is not JSON
  await component(Card, { task: { ...task, id: new Date() } });

  // @ts-expect-error a Map is not JSON
  await component(Typed, { task, when: new Map() });

  // @ts-expect-error unknown prop
  await component(Card, { task, nope: 1 });

  // update() is typed against the component's props, partially.
  await film(component(Card, { task }), async ({ update }) => {
    await update({ note: "x" });
    await update({ task: { ...task, done: true } });

    // @ts-expect-error wrong type
    await update({ note: 5 });

    // @ts-expect-error a Date is not JSON
    await update({ task: { ...task, id: new Date() } });
  });

  // An app target has no props to update.
  await film(
    { url: "", selector: "", sources: async () => "", close: async () => {} },
    async ({ update }) => {
      // @ts-expect-error nothing to update on an app
      await update({});
    },
  );
};
