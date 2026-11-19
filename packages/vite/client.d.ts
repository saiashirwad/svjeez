declare module "*?svjeez" {
  const scene: import("@svjeez/vite").SceneModule;
  export default scene;
}

declare module "*?svjeez&posters" {
  const scene: import("@svjeez/vite").SceneModule &
    Required<Pick<import("@svjeez/vite").SceneModule, "posters">>;

  export default scene;
}
