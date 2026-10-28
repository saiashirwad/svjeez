/// <reference types="astro/client" />
/// <reference types="@svjeez/vite/client" />

declare module "svjeez:astro" {
  export { getScene, type SceneImage, type SceneSource } from "@svjeez/astro/scene";
  export const Scene: typeof import("@svjeez/astro/Scene.astro").default;
}
