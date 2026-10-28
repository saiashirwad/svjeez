declare module "svjeez:astro" {
  export const getScene: typeof import("./scene").getScene;
  export type SceneImage = import("./scene").SceneImage;
  export type SceneSource = import("./scene").SceneSource;
  export const Scene: typeof import("./Scene.astro").default;
}
