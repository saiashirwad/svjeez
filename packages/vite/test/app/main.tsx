/// <reference types="vite/client" />
/// <reference types="../../client.d.ts" />
import { createRoot } from "react-dom/client";
import basic from "../../../../examples/readme/basic.tsx?svjeez&posters";

const App = () => (
  <main style={{ display: "grid", gap: 16, maxWidth: basic.width, margin: "24px auto" }}>
    <img
      id="scene"
      src={basic.src}
      width={basic.width}
      height={basic.height}
      alt={basic.desc || basic.title}
      style={{ maxWidth: "100%", height: "auto" }}
    />
    <picture>
      <source srcSet={basic.posters.dark} media="(prefers-color-scheme: dark)" />
      <img
        id="poster"
        src={basic.posters.light}
        width={basic.width}
        height={basic.height}
        alt=""
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </picture>
  </main>
);

createRoot(document.getElementById("root")!).render(<App />);
