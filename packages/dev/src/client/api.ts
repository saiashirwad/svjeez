import type { ControlValue } from "@svjeez/live";
import type { Preview, StateView, Variant } from "../workspace.ts";

export type { ControlValue };

export type Reply<A> = A | { readonly failure: string };

export const isError = <A extends object>(reply: Reply<A>): reply is { readonly failure: string } =>
  "failure" in reply;

type Body = Readonly<Record<string, ControlValue>>;

const post = async <A extends object>(url: string, body?: Body): Promise<Reply<A>> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

    const reply: Reply<A> = await response.json();

    return reply;
  } catch (error) {
    return { failure: "The dev server did not answer: " + String(error) };
  }
};

export const api = {
  state: async (): Promise<Reply<StateView>> => {
    try {
      const state: StateView = await (await fetch("/api/state")).json();

      return state;
    } catch (error) {
      return { failure: "The dev server did not answer: " + String(error) };
    }
  },
  open: (file: string) => post<StateView>("/api/open", { file }),
  preview: (key: string, value: ControlValue) =>
    post<Preview | { readonly stale: true }>("/api/preview", { key, value }),
  commit: (key: string, value: ControlValue) => post<StateView>("/api/commit", { key, value }),
  extract: (key: string, name: string) => post<StateView>("/api/extract", { key, name }),
  variants: (key: string) =>
    post<{ readonly variants: readonly Variant[] }>("/api/variants", { key }),
  undo: () => post<StateView>("/api/undo"),
  redo: () => post<StateView>("/api/redo"),
};
