import { parse, type Json, type Schema, type Values } from "svjeez/params";

/** A template: `params` is what a query or a prompt may fill, and its default export draws the SVG from them. */
export interface Scene {
  default(values?: Values<Schema>): string;
  readonly params: Schema;
}

/**
 * Every template the Worker serves, imported on first request. They load fonts with top-level await, and a Worker may
 * not fetch outside a request.
 */
const scenes = {
  code: () => import("./templates/code.tsx"),
  terminal: () => import("./templates/terminal.tsx"),
  diagram: () => import("./templates/diagram.tsx"),
  chart: () => import("./templates/chart.tsx"),
  card: () => import("./templates/card.tsx"),
  list: () => import("../../examples/leaderboard/index.tsx"),
  metrics: () => import("../../examples/metrics/index.tsx"),
  math: () => import("./templates/math.tsx"),
} satisfies Readonly<Record<string, () => Promise<Scene>>>;

export type Name = keyof typeof scenes;

export const isName = (name: string): name is Name => Object.hasOwn(scenes, name);

export const names = Object.keys(scenes).filter(isName);

export const load = (name: Name): Promise<Scene> => scenes[name]();

/** The SVG for `json`, read by `parse` and then built. Either step throws with a message that says what to fix. */
export const draw = (scene: Scene, json: Json): string => scene.default(parse(scene.params, json));
