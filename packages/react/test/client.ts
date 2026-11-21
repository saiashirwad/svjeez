import { StrictMode, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Scene } from "../src/index.ts";

// The page's own code runs as text in the test: this is the library it gets, as the global `lib`.
Object.assign(globalThis, {
  lib: { Scene, StrictMode, createElement, createRoot, flushSync, hydrateRoot, renderToString },
});
