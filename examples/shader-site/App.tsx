import { Scene, type Mounted } from "@svjeez/react";
import { useEffect, useRef, useState } from "react";
import heart from "./scenes/heart.tsx?svjeez&inline";
import svjeezLogo from "./scenes/svjeez-logo.tsx?svjeez&inline";
import typegpuLogo from "./scenes/typegpu-logo.tsx?svjeez&inline";
import valley from "./scenes/valley.tsx?svjeez&inline";

const START = 0.74;

// The lockup's scenes take their height from app.css, and their width follows.
const LOGO = { width: "auto", height: "var(--logo)" };
const HEART = { width: "auto", height: "var(--heart)" };

// Where Blip's eyes are, as shares of its box: its scene runs from the top of the bulb to the feet.
const EYES = { x: 0.5, y: 0.61 };

/** Whether a link is hovered or focused, and the handlers that say so. */
const useActive = () => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return [
    hovered || focused,
    {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  ] as const;
};

export const App = () => {
  const hour = useRef(START);
  const valleyScene = useRef<Mounted>(undefined);
  const blipScene = useRef<Mounted>(undefined);
  const blipBox = useRef<HTMLSpanElement>(null);
  const [blip, onBlip] = useActive();
  const [mark, onMark] = useActive();

  // Blip's eyes turn toward the sun, wherever the hour has put it on screen.
  const aim = () => {
    const sun = valleyScene.current?.hit("sun")[0]?.getBoundingClientRect();
    const face = blipBox.current?.getBoundingClientRect();

    if (!sun || !face || !blipScene.current) return;

    const dx = sun.x + sun.width / 2 - (face.x + face.width * EYES.x);
    const dy = sun.y + sun.height / 2 - (face.y + face.height * EYES.y);
    const far = Math.hypot(dx, dy) || 1;

    blipScene.current.clock("gazeX").progress(0.5 + (0.5 * dx) / far);
    blipScene.current.clock("gazeY").progress(0.5 + (0.5 * dy) / far);
  };

  const show = (value: number) => {
    hour.current = value;
    valleyScene.current?.clock("hour").progress(value);
    aim();
  };

  useEffect(() => {
    addEventListener("resize", aim);

    return () => removeEventListener("resize", aim);
  }, []);

  return (
    <main>
      <Scene
        scene={valley}
        onMount={(scene) => {
          valleyScene.current = scene;
          show(hour.current);

          return () => (valleyScene.current = undefined);
        }}
      />
      <div className="lockup">
        <a href="https://svjeez.texoport.in" aria-label="svjeez" {...onBlip}>
          <Scene
            ref={blipBox}
            scene={svjeezLogo}
            state={blip ? "hover" : "idle"}
            style={LOGO}
            onMount={(scene) => {
              blipScene.current = scene;
              aim();

              return () => (blipScene.current = undefined);
            }}
          />
        </a>
        <Scene scene={heart} state={blip || mark ? "pump" : "idle"} style={HEART} />
        <a href="https://docs.swmansion.com/TypeGPU/" aria-label="TypeGPU" {...onMark}>
          <Scene scene={typegpuLogo} state={mark ? "hover" : "idle"} style={LOGO} />
        </a>
      </div>
      <input
        type="range"
        aria-label="Time of day"
        min={0}
        max={1}
        step={0.001}
        defaultValue={START}
        onChange={(event) => show(event.currentTarget.valueAsNumber)}
      />
    </main>
  );
};
