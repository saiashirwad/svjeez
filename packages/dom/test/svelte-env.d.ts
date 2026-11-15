declare module "*.svelte" {
  import type { Component } from "svelte";

  // tsc can't read a .svelte file's props; svelte-check and the Svelte language server can, and type demos fully.
  const component: Component<{ label?: string }>;
  export default component;
}
