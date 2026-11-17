import type { Component, ComponentProps } from "svelte";
import { demoOf, type Demo, type DemoOptions, type Script } from "./demo.ts";
import type { Flow } from "./flow.ts";

export {
  act,
  click,
  drag,
  fill,
  hover,
  move,
  press,
  snap,
  wait,
  type Act,
  type Action,
  type Demo,
  type DemoOptions,
  type DragOptions,
  type Flow,
  type Instruction,
  type PageAction,
  type Script,
  type Snap,
  type Timing,
  type Wait,
} from "./demo.ts";

/**
 * A demo of a real Svelte 5 component: the component, where it starts, and a script of what happens to it. The script
 * is the flow `dom.run` takes; `props` from its argument updates the component's props, typed to it when the
 * component's types are known (svelte-check or the Svelte language server read `.svelte` imports). Export it from a
 * `.demo.ts` file next to the component; `recordings()` renders it through your Vite config.
 *
 * ```ts
 * export const counter = demo(Counter, { width: 200 }, ({ props }) => [
 *   snap(),
 *   click("add"), snap({ over: 0.2 }),
 *   props({ label: "Total" }), snap({ over: 0.2 }),
 * ]);
 * ```
 */
// Svelte's own Component type takes any props.
export const demo = <C extends Component<any>>(
  component: C,
  options: DemoOptions<ComponentProps<C>>,
  script: (tools: Script<ComponentProps<C>>) => Flow,
): Demo<ComponentProps<C>> => demoOf("svelte", component, options, script);
