import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { Scene } from "@svjeez/react";
import { SignUp } from "./SignUp.tsx";
import { Stepper, StepperJump } from "./Stepper.tsx";
import { Tabs } from "./Tabs.tsx";
import toggleArt from "../toggle/index.tsx?svjeez&inline";

// Radix brings the role, the keyboard and the focus; the scene draws the switch and moves with `on`.
const Notifications = () => {
  const [on, setOn] = useState(false);

  return (
    <Switch.Root
      className="control"
      checked={on}
      onCheckedChange={setOn}
      aria-label="Notifications"
    >
      <Scene scene={toggleArt} state={on ? "on" : "off"} style={{ width: 240 }} />
    </Switch.Root>
  );
};

export const App = () => (
  <main>
    <h1>svjeez in React</h1>
    <p>React and its libraries own the state, the keyboard and the labels; scenes only draw.</p>
    <section>
      <h2>Switch (Radix, useState)</h2>
      <Notifications />
    </section>
    <section>
      <h2>Tabs (Radix)</h2>
      <Tabs />
    </section>
    <section>
      <h2>Form (XState)</h2>
      <SignUp />
    </section>
    <section>
      <h2>Stepper (Zustand, buttons elsewhere)</h2>
      <Stepper />
      <StepperJump />
    </section>
  </main>
);
