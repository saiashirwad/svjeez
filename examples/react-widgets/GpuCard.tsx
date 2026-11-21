import { Scene } from "@svjeez/react";
import { useState, type CSSProperties } from "react";
import cardArt from "../gpu-card/index.tsx?svjeez&inline";

type Weather = "calm" | "storm";

const button: CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  padding: "0.5rem 1rem",
  borderRadius: 10,
  border: "1px solid light-dark(#D2D2D7, #3A3A3C)",
  background: "light-dark(#FFFFFF, #1C1C1E)",
  color: "inherit",
  cursor: "pointer",
};

// React owns the weather. The scene draws it, and its own <Shader> follows the scene's storm clock.
export const GpuCard = () => {
  const [weather, setWeather] = useState<Weather>("calm");
  const next = weather === "calm" ? "storm" : "calm";

  return (
    <section style={{ display: "grid", gap: "0.75rem", maxWidth: 562 }}>
      <Scene scene={cardArt} state={weather} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button type="button" style={button} onClick={() => setWeather(next)}>
          {weather === "calm" ? "Brew a storm" : "Calm it down"}
        </button>
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          {weather === "calm" ? "Calm: a slow, cool aurora." : "Storm: fast, turbulent and hot."}
        </p>
      </div>
    </section>
  );
};
