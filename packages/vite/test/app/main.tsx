/// <reference types="vite/client" />
/// <reference types="../../client.d.ts" />
import { createRoot } from "react-dom/client";
import hero from "../../../svjeez/examples/readme/hero.tsx?svjeez&posters";

const App = () => (
  <main style={{ display: "grid", gap: 16, maxWidth: hero.width, margin: "24px auto" }}>
    <img
      id="scene"
      src={hero.src}
      width={hero.width}
      height={hero.height}
      alt={hero.desc || hero.title}
      style={{ maxWidth: "100%", height: "auto" }}
    />
    <picture>
      <source srcSet={hero.posters.dark} media="(prefers-color-scheme: dark)" />
      <img
        id="poster"
        src={hero.posters.light}
        width={hero.width}
        height={hero.height}
        alt=""
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </picture>
  </main>
);

createRoot(document.getElementById("root")!).render(<App />);
