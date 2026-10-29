import { timeAt } from "@svjeez/live";
import { useEffect, useState } from "react";
import type { SceneEditor } from "./editor.ts";

export function Transport({ editor }: { editor: SceneEditor }) {
  const doc = editor.state;
  const playing = doc.clock.playing;
  const duration = doc.picture?.scene.duration ?? 0;

  const [now, setNow] = useState(0);
  /** The time under the thumb while it is held, so the playhead does not fight the drag. */
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  // The playhead reads the clock on every frame while it runs, and once when it stops.
  useEffect(() => {
    setNow(performance.now());

    if (!playing) return;

    let frame = requestAnimationFrame(function tick(t) {
      setNow(t);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const t = timeAt(doc.clock, now);
  const time = scrubbing ?? (duration ? t % duration : t);
  const done = () => setScrubbing(null);

  return (
    <div className="sj-transport">
      <button
        className="sj-play"
        type="button"
        data-playing={playing || undefined}
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => editor.send({ type: playing ? "pause" : "play" })}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {playing ? <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" /> : <path d="M4 2l10 6-10 6z" />}
        </svg>
      </button>
      <input
        className="sj-scrub"
        type="range"
        min="0"
        max={duration}
        step="any"
        aria-label="Time"
        value={time}
        disabled={!duration}
        onChange={(e) => {
          const at = e.currentTarget.valueAsNumber;
          setScrubbing(at);
          editor.send({ type: "seek", at });
        }}
        onPointerUp={done}
        onKeyUp={done}
        onBlur={done}
      />
      <output className="sj-time">
        {time.toFixed(2)} / {duration.toFixed(2)}s
      </output>
    </div>
  );
}
