import { Scene, type Mounted } from "@svjeez/react";
import { useRef } from "react";
import dusk from "./scenes/dusk.tsx?svjeez&inline";

const START = 0.35;

export const App = () => {
  const mounted = useRef<Mounted>(undefined);

  return (
    <main>
      <Scene
        scene={dusk}
        style={{ width: "100%" }}
        onMount={(scene) => {
          mounted.current = scene;
          scene.clock("hour").progress(START);
        }}
      />
      <input
        type="range"
        aria-label="Time of day"
        min={0}
        max={1}
        step={0.001}
        defaultValue={START}
        onChange={(event) =>
          mounted.current?.clock("hour").progress(event.currentTarget.valueAsNumber)
        }
      />
    </main>
  );
};
