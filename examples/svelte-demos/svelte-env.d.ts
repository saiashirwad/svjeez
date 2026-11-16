/// <reference types="vite/client" />

// tsc can't read a .svelte file's props, so here a component takes any. svelte-check and the Svelte language server
// read them, and type a demo's props() fully.
declare module "*.svelte" {
  import type { Component } from "svelte";

  const component: Component<any>;
  export default component;
}
