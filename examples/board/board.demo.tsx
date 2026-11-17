// What happens to the board, as data. recordings() films it in Chromium through the app's own Vite config.
import { click, demo, drag, fill, press, snap, wait } from "@svjeez/dom/react";
import { Board } from "./app.tsx";

const layout = { width: 800, pad: 0 };

export const board = demo(Board, layout, () => [
  snap("idle"),
  wait(1.2),
  press("ControlOrMeta+k"),
  snap("palette", { over: 0.35 }),
  fill("query", "new"),
  snap("query", { over: 0.45 }),
  fill("query", "new iss"),
  snap("narrowed", { over: 0.4 }),
  wait(0.4),
  click("cmd-new-issue"),
  snap("dialog", { over: 0.3 }),
  fill("title", "Save drafts offline"),
  snap("titled", { over: 1.1 }),
  wait(0.3),
  click("label-feature"),
  snap("labelled", { over: 0.2 }),
  wait(0.35),
  click("who-mara"),
  snap("assigned", { over: 0.2 }),
  wait(0.4),
  click("create"),
  snap("created", { over: 0.6 }),
  wait(0.9),
  ...drag("card-ENG-143", "lane-progress", {
    grab: [0.55, 0.35],
    release: [0.5, 0.2],
    steps: 6,
    carried: snap("carried", { over: 0.6 }),
    dropped: snap("dropped", { over: 0.2 }),
  }),
  wait(0.6),
  click("status-ENG-143"),
  snap("menu", { over: 0.25 }),
  wait(0.4),
  click("set-done"),
  snap("done", { over: 0.7 }),
  wait(2.8),
]);
