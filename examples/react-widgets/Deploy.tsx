import { useMachine } from "@xstate/react";
import { Scene } from "@svjeez/react";
import type { CSSProperties } from "react";
import { setup, stateIn } from "xstate";
import deployArt from "../deploy/index.tsx?svjeez&inline";

type DeployEvent =
  | { readonly type: "deploy" }
  | { readonly type: "retry" }
  | { readonly type: "failTests" }
  | { readonly type: "passTests" };

// SAFETY: XState reads this placeholder only as a type and never uses it as a value.
const types = { events: {} as DeployEvent };

// Two regions: the pipeline, which times itself with delayed transitions, and whether the tests will fail. The
// snapshot's value, such as { pipeline: { running: "test" }, tests: "failing" }, is the scene's state as it is.
const deploy = setup({ types, guards: { testsFail: stateIn({ tests: "failing" }) } }).createMachine(
  {
    id: "deploy",
    type: "parallel",
    states: {
      pipeline: {
        initial: "idle",
        states: {
          idle: { on: { deploy: "running" } },
          running: {
            initial: "build",
            states: {
              build: { after: { 2200: "test" } },
              test: {
                after: {
                  2800: [
                    { guard: "testsFail", target: "#deploy.pipeline.failed" },
                    { target: "deploy" },
                  ],
                },
              },
              deploy: { after: { 2400: "#deploy.pipeline.live" } },
            },
          },
          failed: { on: { retry: "running" } },
          live: { on: { deploy: "running" } },
        },
      },
      tests: {
        initial: "passing",
        states: {
          passing: { on: { failTests: "failing" } },
          failing: { on: { passTests: "passing" } },
        },
      },
    },
  },
);

const said = [
  [{ pipeline: "idle" }, "Ready to deploy 3f9c2a1 to production."],
  [{ pipeline: { running: "build" } }, "Building 3f9c2a1."],
  [{ pipeline: { running: "test" } }, "Running 128 specs."],
  [{ pipeline: { running: "deploy" } }, "Tests passed. Rolling out to 3 regions."],
  [
    { pipeline: "failed" },
    "3 of 128 specs failed in auth/session.test.ts. The deploy halted before Deploy.",
  ],
  [{ pipeline: "live" }, "Live on acme.app: v2.4.0 in 3 regions."],
] as const;

const primary: CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  padding: "0.5rem 1rem",
  borderRadius: 10,
  border: "1px solid #0A6CFF",
  background: "#0A6CFF",
  color: "#FFFFFF",
  cursor: "pointer",
};

// XState owns the pipeline and React the controls and the words; the scene only draws the state it's given.
export const Deploy = () => {
  const [snapshot, send] = useMachine(deploy);
  const running = snapshot.matches({ pipeline: "running" });
  const failed = snapshot.matches({ pipeline: "failed" });
  const status = said.find(([state]) => snapshot.matches(state))?.[1];

  return (
    <section style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
      <Scene scene={deployArt} state={snapshot.value} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          style={{ ...primary, opacity: running ? 0.5 : 1 }}
          disabled={running}
          onClick={() => send({ type: failed ? "retry" : "deploy" })}
        >
          {failed ? "Retry" : snapshot.matches({ pipeline: "live" }) ? "Redeploy" : "Deploy"}
        </button>
        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={snapshot.matches({ tests: "failing" })}
            onChange={(event) => send({ type: event.target.checked ? "failTests" : "passTests" })}
          />
          Make the tests fail
        </label>
      </div>
      <p role="status" aria-live="polite" style={{ margin: 0 }}>
        {status}
      </p>
    </section>
  );
};
