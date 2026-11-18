import type { ComponentType } from "react";
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

export const demo = <P extends object>(
  component: ComponentType<P>,
  options: DemoOptions<P>,
  script: (tools: Script<P>) => Flow,
): Demo<P> => demoOf("react", component, options, script);
