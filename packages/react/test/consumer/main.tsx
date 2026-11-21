import { Scene, useScene, type SceneArt, type SceneProps } from "@svjeez/react";

export const art: SceneArt = { svg: "<svg></svg>", width: 60, height: 40 };

export const props: SceneProps = { scene: art, state: { menu: "open" }, label: "Menu" };

export const element = <Scene {...props} />;

export const hook = () => useScene(art, { state: "on" });
