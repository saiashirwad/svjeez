import type { Schema, Values } from "svjeez/params";

/** A scene module: its default export draws the SVG, and `params`, when it has one, is what a request may fill. */
export interface Scene {
  default(values?: Values<Schema>): string;
  readonly params?: Schema;
}

/**
 * Every scene the Worker serves, imported on first request. The examples load fonts with top-level await, and a Worker
 * may not fetch outside a request.
 */
const scenes = {
  "release-card": () => import("../../examples/release-card/index.tsx"),
  leaderboard: () => import("../../examples/leaderboard/index.tsx"),
  metrics: () => import("../../examples/metrics/index.tsx"),
  charts: () => import("../../examples/charts/index.tsx"),
  flowchart: () => import("../../examples/flowchart/index.tsx"),
  sequence: () => import("../../examples/sequence/index.tsx"),
  state: () => import("../../examples/state/index.tsx"),
  mermaid: () => import("../../examples/mermaid/index.tsx"),
  code: () => import("../../examples/code/index.tsx"),
  terminal: () => import("../../examples/terminal/index.tsx"),
  math: () => import("../../examples/math/index.tsx"),
  icons: () => import("../../examples/icons/index.tsx"),
} satisfies Readonly<Record<string, () => Promise<Scene>>>;

export type Name = keyof typeof scenes;

export const isName = (name: string): name is Name => Object.hasOwn(scenes, name);

export const names = Object.keys(scenes).filter(isName);

export const load = (name: Name): Promise<Scene> => scenes[name]();
