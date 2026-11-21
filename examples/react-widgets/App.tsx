import { Deploy } from "./Deploy.tsx";
import { GpuCard } from "./GpuCard.tsx";
import { Mascot } from "./Mascot.tsx";
import { Watch } from "./Watch.tsx";

export const App = () => (
  <main>
    <header>
      <h1>svjeez in React</h1>
      <p>
        React owns the state, the events and the accessibility. A scene declares its states and
        draws them, moving from wherever it is whenever the state changes.
      </p>
    </header>
    <section aria-labelledby="mascot">
      <h2 id="mascot">Sign in, with a robot watching</h2>
      <p>
        A plain form keeps its focus, errors and announcements; the robot follows the pointer, the
        caret, and the result.
      </p>
      <Mascot />
    </section>
    <section aria-labelledby="deploy">
      <h2 id="deploy">A deploy pipeline</h2>
      <p>
        XState runs the pipeline and React the buttons; the scene draws whatever state XState is in,
        nested regions included.
      </p>
      <Deploy />
    </section>
    <section aria-labelledby="watch">
      <h2 id="watch">How a watch keeps time</h2>
      <p>
        Radio buttons and a slider choose what to look at and where in the motion; the scene's
        camera and clocks do the rest.
      </p>
      <Watch />
    </section>
    <section aria-labelledby="signal">
      <h2 id="signal">A card with a GPU inside</h2>
      <p>
        The scene draws the frame, the words and the scale, and leaves a slot; TypeGPU renders a
        live aurora into it that follows the same storm clock as the badge and the readouts.
      </p>
      <GpuCard />
    </section>
  </main>
);
