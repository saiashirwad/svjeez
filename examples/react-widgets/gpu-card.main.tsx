import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GpuCard } from "./GpuCard.tsx";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main style={{ maxWidth: 562 }}>
      <h1>Signal card</h1>
      <GpuCard />
    </main>
  </StrictMode>,
);
