import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Scene, type Mounted } from "@svjeez/react";
import type { Driver } from "svjeez/page";
import mascotArt from "../mascot/index.tsx?svjeez&inline";

type Field = "email" | "password";

type Result = "idle" | "checking" | "failed" | "success";

/** The one password the fake server turns down, so both endings are a click away. */
const REJECTED = "password";

const signIn = (password: string) =>
  new Promise<boolean>((resolve) => setTimeout(() => resolve(password !== REJECTED), 1400));

// Where the pointer is, seen from the robot's face: 0.5 straight ahead, 0 and 1 a reach away to either side.
const gaze =
  (face: Element, axis: "x" | "y", reach: number): Driver =>
  (progress) => {
    const move = (event: PointerEvent) => {
      const { left, top, width, height } = face.getBoundingClientRect();
      const from = axis === "x" ? left + width / 2 : top + height * 0.4;
      const to = axis === "x" ? event.clientX : event.clientY;

      progress(Math.min(1, Math.max(0, 0.5 + (to - from) / (2 * reach))));
    };

    addEventListener("pointermove", move);

    return () => removeEventListener("pointermove", move);
  };

// The caret's share of a line that fits about 30 characters, kept away from the edges of the visor.
const caretAt = (input: HTMLInputElement) =>
  0.1 + 0.8 * Math.min(1, (input.selectionStart ?? input.value.length) / 30);

const css = `
.mascot { width: 360px; max-width: 100%; font-family: system-ui, sans-serif; color: light-dark(#1d1d1f, #e5e5ea); }
.mascot-card { display: grid; gap: 14px; margin-top: -28px; padding: 34px 24px 24px; border: 1.5px solid light-dark(#e5e5ea, #27272a);
  border-top: 0; border-radius: 0 0 20px 20px; background: light-dark(#f5f5f7, #18181b); }
.mascot-card h2 { margin: 0; font-size: 1.15rem; }
.mascot-card label { display: grid; gap: 6px; font-size: 0.85rem; font-weight: 600; }
.mascot-card input { box-sizing: border-box; height: 42px; padding: 0 12px; border: 1.5px solid light-dark(#d1d1d6, #3a3a3f);
  border-radius: 10px; background: light-dark(#fff, #090a0c); color: inherit; font: inherit; font-weight: 400; }
.mascot-card input:focus-visible, .mascot-card button:focus-visible { outline: 2px solid light-dark(#0a6cff, #5ea0ff); outline-offset: 2px; }
.mascot-card input[aria-invalid="true"] { border-color: light-dark(#e5453b, #ff6961); }
.mascot-card button { height: 44px; border: 0; border-radius: 10px; background: light-dark(#0a6cff, #5ea0ff);
  color: light-dark(#fff, #090a0c); font: inherit; font-weight: 600; cursor: pointer; }
.mascot-card button[aria-disabled="true"] { opacity: 0.6; cursor: progress; }
.mascot-card .hint { margin: 0; font-size: 0.8rem; color: light-dark(#6e6e73, #a1a1a6); }
.mascot-card .error { margin: 0; font-size: 0.85rem; color: light-dark(#e5453b, #ff6961); }
.mascot-card .done { margin: 0; font-size: 0.95rem; }
`;

/**
 * A sign-in form with a robot that watches it. React owns the form, its focus, its errors and its announcements;
 * the scene only draws, told one of the states it declares. Its eyes are the two clocks the page drives directly:
 * the pointer while idle, the caret while the email is typed.
 */
export const Mascot = () => {
  const [field, setField] = useState<Field | undefined>(undefined);
  const [result, setResult] = useState<Result>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const scene = useRef<Mounted | undefined>(undefined);
  const face = useRef<HTMLSpanElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const id = useId();

  const state =
    result === "checking" || result === "success" || result === "failed"
      ? result
      : (field ?? "idle");

  const look = (input: HTMLInputElement) => {
    const lookX = scene.current?.clock("lookX");

    void lookX?.to(caretAt(input) * lookX.over);
  };

  // Idle eyes follow the pointer; typing an email they follow the caret, from look().
  useEffect(() => {
    const mounted = scene.current;

    if (state !== "idle" || !mounted || !face.current) return;

    const stops = [
      mounted.clock("lookX").follow(gaze(face.current, "x", 420)),
      mounted.clock("lookY").follow(gaze(face.current, "y", 320)),
    ];

    return () => stops.forEach((stop) => stop());
  }, [state]);

  useEffect(() => {
    if (state === "email" && emailInput.current) look(emailInput.current);
  }, [state]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (result === "checking") return;
    setResult("checking");
    const ok = await signIn(password);

    setResult(ok ? "success" : "failed");

    if (!ok) passwordInput.current?.focus();
  };

  const reset = () => {
    setResult("idle");
    setPassword("");
  };

  return (
    <div className="mascot">
      <style>{css}</style>
      <Scene
        ref={face}
        scene={mascotArt}
        state={state}
        onMount={(mounted) => {
          scene.current = mounted;

          return () => (scene.current = undefined);
        }}
        style={{ width: "100%", position: "relative" }}
      />
      {result === "success" ? (
        <div className="mascot-card">
          <h2>Welcome back</h2>
          <p className="done" role="status">
            You're signed in as {email || "a mystery guest"}.
          </p>
          <button type="button" onClick={reset}>
            Sign out
          </button>
        </div>
      ) : (
        <form className="mascot-card" onSubmit={submit} noValidate>
          <h2>Sign in</h2>
          <label>
            Email
            <input
              ref={emailInput}
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              onFocus={() => setField("email")}
              onBlur={() => setField(undefined)}
              onChange={(event) => {
                setEmail(event.target.value);
                setResult("idle");
                look(event.target);
              }}
              onSelect={(event) => look(event.currentTarget)}
            />
          </label>
          <label>
            Password
            <input
              ref={passwordInput}
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={result === "failed"}
              aria-describedby={result === "failed" ? `${id}-error` : `${id}-hint`}
              onFocus={() => setField("password")}
              onBlur={() => setField(undefined)}
              onChange={(event) => {
                setPassword(event.target.value);
                setResult("idle");
              }}
            />
          </label>
          <div aria-live="assertive">
            {result === "failed" ? (
              <p id={`${id}-error`} className="error">
                That password didn't work. Try another one.
              </p>
            ) : null}
          </div>
          <p id={`${id}-hint`} className="hint">
            Any password signs you in, except "{REJECTED}".
          </p>
          <button aria-disabled={result === "checking"}>
            {result === "checking" ? "Signing in…" : "Sign in"}
          </button>
          <p className="hint" role="status">
            {result === "checking" ? "Checking your password." : ""}
          </p>
        </form>
      )}
    </div>
  );
};
