import { svg } from "svjeez/tools";

/**
 * A scene's SVG to inline in the page, so it paints with the page's colors: its `ink` is currentColor and its `bg`, if it
 * has one, the page's. The prefix keeps its ids apart from other inlined scenes'.
 */
export const inline = (scene: Parameters<typeof svg.emit>[0], prefix: string) =>
  svg.emit(scene, {
    prefix,
    resolve: { ink: "currentColor", ...("bg" in scene.tokens && { bg: "inherit" }) },
  });
