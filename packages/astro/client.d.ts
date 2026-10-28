/// <reference types="astro/client" />

declare module "svjeez:astro" {
  export const getScene: typeof import("./src/scene").getScene;
  export type SceneImage = import("./src/scene").SceneImage;
  export type SceneSource = import("./src/scene").SceneSource;
  export const Scene: typeof import("./src/Scene.astro").default;
}
