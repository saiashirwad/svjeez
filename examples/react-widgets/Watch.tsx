import { Scene, type Mounted } from "@svjeez/react";
import { useRef, useState, type CSSProperties } from "react";
import watchArt from "../watch/index.tsx?svjeez&inline";

const parts = [
  {
    id: "overview",
    name: "Overview",
    caption:
      "A mechanical watch runs on a wound spring, and the escapement lets it unwind in small, equal steps. The balance wheel swings, the pallet fork rocks, and the escape wheel moves on one step each time.",
  },
  {
    id: "escape",
    name: "Escape wheel",
    caption:
      "The last wheel of the gear train, always pushed by the mainspring. A ruby pallet stone locks one of its fifteen teeth; each time the fork lets go it moves on half a tooth, and the tooth slides along the stone and nudges the fork.",
  },
  {
    id: "fork",
    name: "Pallet fork",
    caption:
      "A lever with two ruby stones that rocks between two banking pins. The balance's pin swings through the notch at its end and throws it over: one stone lets a tooth go and the other catches the next.",
  },
  {
    id: "balance",
    name: "Balance wheel",
    caption:
      "The timekeeper. A hairspring swings it back and forth at a steady rate, like a pendulum. Every swing is one beat, and the fork hands it a small push on each one, so it never runs down.",
  },
] as const;

type Part = (typeof parts)[number]["id"];

const isPart = (id: string): id is Part => parts.some((part) => part.id === id);

const STEPS = 1000;
const BEATS = 12;

const ink = "light-dark(#1D1D1F, #E5E5EA)";
const muted = "light-dark(#6E6E73, #A1A1A6)";
const line = "light-dark(#E5E5EA, #27272A)";
const accent = "light-dark(#0A6CFF, #5EA0FF)";

const styles = {
  figure: { display: "grid", gap: 16, maxWidth: 800, margin: 0, color: ink },
  art: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${line}`,
  },
  parts: { display: "flex", flexWrap: "wrap", gap: 8, border: 0, padding: 0, margin: 0 },
  legend: { fontSize: 13, color: muted, marginBottom: 8, padding: 0 },
  choice: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: line,
    cursor: "pointer",
    fontSize: 14,
  },
  chosen: { borderColor: accent, color: accent },
  transport: { display: "flex", alignItems: "center", gap: 12 },
  button: {
    minWidth: 76,
    padding: "6px 14px",
    borderRadius: 8,
    border: `1px solid ${line}`,
    background: "transparent",
    color: ink,
    font: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  slider: { flex: 1, accentColor: accent },
  caption: { margin: 0, maxWidth: "62ch", lineHeight: 1.55, fontSize: 15 },
} satisfies Record<string, CSSProperties>;

/**
 * An explainer of a watch escapement. React owns which part is in focus and whether the mechanism runs; the scene
 * declares those states, loops its "tick" clock while playing, and moves a camera (a "lens" clock that zooms and a
 * clock per part that pans to it) around the mechanism, which ticks on inside it. The range input
 * scrubs "tick" through follow(), and the clock moves the thumb back while it plays.
 */
export const Watch = () => {
  const [part, setPart] = useState<Part>("overview");
  const [playing, setPlaying] = useState(true);
  const shown = parts.find(({ id }) => id === part)!;
  const time = useRef<HTMLInputElement>(null);
  const scrub = useRef<((amount: number) => void) | undefined>(undefined);

  const onMount = (scene: Mounted) => {
    const tick = scene.clock("tick");

    // The range input drives the clock while the reader moves it, by pointer or by keyboard.
    const unfollow = tick.follow((progress) => {
      scrub.current = progress;

      return () => {
        scrub.current = undefined;
      };
    });

    // And the clock moves the thumb while it plays.
    let frame = requestAnimationFrame(function mirror() {
      const amount = tick.time / tick.over;
      const slider = time.current;

      if (slider) {
        slider.value = String(Math.round(amount * STEPS));
        slider.setAttribute("aria-valuetext", `Beat ${Math.floor(amount * BEATS) + 1} of ${BEATS}`);
      }

      frame = requestAnimationFrame(mirror);
    });

    // Clicking a part focuses it too; the radios are the way to it for the keyboard and assistive technology.
    // Only the parts take the pointer, so the spotlights drawn over them don't catch it.
    const art = scene.hit("escape")[0]?.closest("svg");

    art?.style.setProperty("pointer-events", "none");

    const unclick = (["escape", "fork", "balance"] as const).flatMap((id) =>
      scene
        .hit(id)
        .filter((element) => element instanceof SVGElement)
        .map((element) => {
          const focus = () => setPart(id);

          element.style.setProperty("cursor", "pointer");
          element.style.setProperty("pointer-events", "auto");
          element.addEventListener("click", focus);

          return () => element.removeEventListener("click", focus);
        }),
    );

    return () => {
      unfollow();
      cancelAnimationFrame(frame);
      unclick.forEach((stop) => stop());
    };
  };

  return (
    <figure style={styles.figure}>
      <Scene
        scene={watchArt}
        state={{ motion: playing ? "playing" : "paused", focus: part }}
        onMount={onMount}
        style={styles.art}
      />
      <fieldset style={styles.parts}>
        <legend style={styles.legend}>Look at</legend>
        {parts.map(({ id, name }) => (
          <label key={id} style={{ ...styles.choice, ...(id === part && styles.chosen) }}>
            <input
              type="radio"
              name="watch-part"
              value={id}
              checked={id === part}
              onChange={(event) => isPart(event.target.value) && setPart(event.target.value)}
            />
            {name}
          </label>
        ))}
      </fieldset>
      <div style={styles.transport}>
        <button type="button" style={styles.button} onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play"}
        </button>
        <label htmlFor="watch-time" style={{ fontSize: 13, color: muted }}>
          Time
        </label>
        <input
          ref={time}
          id="watch-time"
          type="range"
          min={0}
          max={STEPS}
          defaultValue={0}
          style={styles.slider}
          onChange={(event) => {
            setPlaying(false);
            scrub.current?.(event.target.valueAsNumber / STEPS);
          }}
        />
      </div>
      <figcaption aria-live="polite" style={styles.caption}>
        <strong>{shown.name}.</strong> {shown.caption}
      </figcaption>
    </figure>
  );
};
