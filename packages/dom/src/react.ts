import type { ComponentType } from "react";
import { demoOf, type Demo, type DemoOptions, type Script } from "./demo.ts";
import type { Flow } from "./flow.ts";

export { click, fill, hover, move, press, snap, wait, type Demo, type DemoOptions, type Flow, type Script } from "./demo.ts";

/**
 * A demo of a real React component: the component, where it starts, and a script of what happens to it. The script
 * is the flow `dom.run` takes; `props` from its argument re-renders the component with new props and is typed to it.
 * Export it from a `.demo.tsx` file next to the component; `recordings()` renders it through your Vite config, so
 * your CSS, fonts and imports are the app's own.
 *
 * ```tsx
 * export const signIn = demo(SignIn, { width: 360 }, ({ props }) => [
 *   snap("idle"),
 *   fill("email", "sai@example.com"), snap({ over: 1 }),
 *   props({ error: "Unable to sign in." }), snap({ over: 0.25 }),
 * ]);
 * ```
 */
export const demo = <P extends object>(
  component: ComponentType<P>,
  options: DemoOptions<P>,
  script: (tools: Script<P>) => Flow,
): Demo<P> => demoOf("react", component, options, script);
