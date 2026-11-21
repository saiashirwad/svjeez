import { Scene } from "@svjeez/react";
import { create } from "zustand";
import { over } from "./overlay.ts";
import stepperArt from "../stepper/index.tsx?svjeez&inline";

const steps = ["plan", "build", "test", "ship"] as const;

type Step = (typeof steps)[number];

interface Progress {
  readonly step: Step;
  go(step: Step): void;
  walk(by: number): void;
}

// The state lives in a store, so any component can move the scene.
const useProgress = create<Progress>((set) => ({
  step: "plan",
  go: (step) => set({ step }),
  walk: (by) =>
    set(({ step }) => ({
      step: steps[Math.min(steps.length - 1, Math.max(0, steps.indexOf(step) + by))]!,
    })),
}));

export const Stepper = () => {
  const { step, walk } = useProgress();

  return (
    <div className="stage" style={{ width: 480 }}>
      <Scene scene={stepperArt} state={step} style={{ width: "100%" }} />
      <button
        className="control ghost"
        style={over(stepperArt, 140, 206, 96, 36)}
        onClick={() => walk(-1)}
      >
        Back
      </button>
      <button
        className="control ghost"
        style={over(stepperArt, 244, 206, 96, 36)}
        onClick={() => walk(1)}
      >
        Next
      </button>
    </div>
  );
};

export const StepperJump = () => {
  const { step, go } = useProgress();

  return (
    <div className="row" role="group" aria-label="Jump to a step">
      {steps.map((name) => (
        <button key={name} aria-pressed={name === step} onClick={() => go(name)}>
          {name}
        </button>
      ))}
    </div>
  );
};
