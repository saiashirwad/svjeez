declare module "*?svjeez" {
  const scene: import("@svjeez/vite").SceneModule;
  export default scene;
}

declare module "*?svjeez&inline" {
  const scene: import("@svjeez/vite").SceneModule &
    Required<Pick<import("@svjeez/vite").SceneModule, "svg">>;

  export default scene;
}

declare module "*?svjeez&posters" {
  const scene: import("@svjeez/vite").SceneModule &
    Required<Pick<import("@svjeez/vite").SceneModule, "posters">>;

  export default scene;
}

declare module "*?svjeez&posters&inline" {
  const scene: import("@svjeez/vite").SceneModule &
    Required<Pick<import("@svjeez/vite").SceneModule, "svg" | "posters">>;

  export default scene;
}

declare module "*?svjeez&inline&posters" {
  const scene: import("@svjeez/vite").SceneModule &
    Required<Pick<import("@svjeez/vite").SceneModule, "svg" | "posters">>;

  export default scene;
}
