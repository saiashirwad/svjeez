import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const params = new URLSearchParams(location.search);

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App
      scene={params.get("scene")}
      wrap={params.has("wrap")}
      memo={params.has("memo")}
      hideable={params.has("hideable")}
    />
  </StrictMode>,
);
