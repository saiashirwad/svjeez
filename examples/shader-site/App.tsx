import { Scene, type Mounted } from "@svjeez/react";
import { useRef } from "react";
import valley from "./scenes/valley.tsx?svjeez&inline";

const START = 0.74;

export const App = () => {
  const mounted = useRef<Mounted>(undefined);

  return (
    <main>
      <Scene
        scene={valley}
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
