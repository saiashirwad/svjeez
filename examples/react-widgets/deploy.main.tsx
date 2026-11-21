import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Deploy } from "./Deploy.tsx";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main style={{ maxWidth: 720 }}>
      <h1>Deploy pipeline</h1>
      <Deploy />
    </main>
  </StrictMode>,
);
