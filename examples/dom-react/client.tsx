import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.body.appendChild(document.createElement("div"))).render(<App />);
