import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Mascot } from "./Mascot.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Mascot />
  </StrictMode>,
);
