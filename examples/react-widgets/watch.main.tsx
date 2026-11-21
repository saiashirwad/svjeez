import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Watch } from "./Watch.tsx";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main style={{ maxWidth: 800 }}>
      <h1>How a watch keeps time</h1>
      <Watch />
    </main>
  </StrictMode>,
);
