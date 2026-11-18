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

export const demo = <C extends Component<any>>(
  component: C,
  options: DemoOptions<ComponentProps<C>>,
  script: (tools: Script<ComponentProps<C>>) => Flow,
): Demo<ComponentProps<C>> => demoOf("svelte", component, options, script);
