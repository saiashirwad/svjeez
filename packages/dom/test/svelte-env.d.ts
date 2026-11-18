declare module "*.svelte" {
  import type { Component } from "svelte";

  const component: Component<{ label?: string }>;
  export default component;
}
