// A demo of the app's real Svelte component: what happens to it, as data. recordings() films it.
import { click, demo, hover, snap, wait } from "@svjeez/dom/svelte";
import Notifications from "./Notifications.svelte";

export const notifications = demo(Notifications, { width: 380 }, ({ props }) => [
  snap("start"),
  wait(0.6),
  click("reviews"),
  snap("reviews", { over: 0.2 }),
  wait(0.5),
  click("digest"),
  snap("digest", { over: 0.2 }),
  wait(0.5),
  click("mentions"),
  snap("mentions", { over: 0.2 }),
  wait(0.5),
  hover("save"),
  snap("hover", { over: 0.15 }),
  wait(0.3),
  // The server confirms: the parent passes `saved`, and the switches keep their state.
  props({ saved: true }),
  snap("saved", { over: 0.25 }),
  wait(1.6),
]);
