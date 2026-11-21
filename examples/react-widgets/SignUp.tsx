import { useMachine } from "@xstate/react";
import { Scene } from "@svjeez/react";
import { assign, setup, stateIn } from "xstate";
import { over } from "./overlay.ts";
import formArt from "../xstate-form/index.tsx?svjeez&inline";

const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Form {
  readonly address: string;
}

type FormEvent =
  | { readonly type: "input"; readonly address: string }
  | { readonly type: "check" }
  | { readonly type: "submit" };

// SAFETY: XState reads these placeholders only as types and never uses them as values.
const types = { context: {} as Form, events: {} as FormEvent };

// Two regions: the field's verdict and the submission. Their values are the scene's states.
const signUp = setup({
  types,
  guards: { looksValid: ({ context }) => email.test(context.address) },
}).createMachine({
  type: "parallel",
  context: { address: "" },
  states: {
    field: {
      initial: "empty",
      states: { empty: {}, typing: {}, valid: {}, invalid: {} },
      on: {
        input: [
          {
            guard: ({ event }) => event.address === "",
            target: ".empty",
            actions: assign({ address: ({ event }) => event.address }),
          },
          { target: ".typing", actions: assign({ address: ({ event }) => event.address }) },
        ],
        check: [
          { guard: "looksValid", target: ".valid" },
          { guard: ({ context }) => context.address !== "", target: ".invalid" },
        ],
      },
    },
    submit: {
      initial: "idle",
      states: {
        idle: { on: { submit: { guard: stateIn({ field: "valid" }), target: "sending" } } },
        sending: { after: { 1400: "done" } },
        done: {},
      },
      on: { input: ".idle" },
    },
  },
});

const labels = { idle: "Sign up", sending: "Signing up", done: "Signed up" };

// The scene draws the field and the button; a real input and button sit over them.
export const SignUp = () => {
  const [snapshot, send] = useMachine(signUp);
  const invalid = snapshot.matches({ field: "invalid" });

  return (
    <form
      className="stage"
      style={{ width: 400 }}
      onSubmit={(event) => {
        event.preventDefault();
        send({ type: "check" });
        send({ type: "submit" });
      }}
    >
      <Scene scene={formArt} state={snapshot.value} style={{ width: "100%" }} />
      <input
        type="email"
        className="field"
        style={over(formArt, 40, 76, 320, 48)}
        aria-label="Email"
        aria-invalid={invalid}
        aria-describedby={invalid ? "email-error" : undefined}
        placeholder="you@example.com"
        autoComplete="off"
        onChange={(event) => send({ type: "input", address: event.target.value })}
        onBlur={() => send({ type: "check" })}
      />
      {invalid && (
        <p id="email-error" role="alert" className="ghost" style={over(formArt, 40, 136, 320, 20)}>
          Enter an email like you@example.com
        </p>
      )}
      <button
        className="control ghost"
        style={over(formArt, 40, 176, 320, 48)}
        aria-disabled={!snapshot.matches({ field: "valid" })}
      >
        {labels[snapshot.value.submit]}
      </button>
    </form>
  );
};
