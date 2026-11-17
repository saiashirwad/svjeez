import { click, demo, fill, hover, snap, wait } from "@svjeez/dom/react";
import { PullRequest, SignIn } from "./ui.tsx";

export const signIn = demo(SignIn, { width: 360 }, ({ props }) => [
  snap("idle"),
  wait(0.5),
  fill("email", "sai@example.com"),
  snap("email", { over: 0.9 }),
  wait(0.2),
  fill("password", "hunter2hunter2"),
  snap("password", { over: 0.7 }),
  wait(0.3),
  hover("submit"),
  snap("hover", { over: 0.15 }),
  wait(0.3),
  props({ error: "Unable to sign in." }),
  snap("failed", { over: 0.25 }),
  wait(1.8),
]);

export const pullRequest = demo(PullRequest, { width: 420 }, ({ props }) => [
  snap("open"),
  wait(1),
  click("auto"),
  snap("auto", { over: 0.2 }),
  wait(1.2),
  props({ merged: true }),
  snap("merged", { over: 0.3 }),
  wait(2.6),
]);
