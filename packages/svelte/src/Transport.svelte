<script lang="ts">
  import { timeAt } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";

  let { editor }: { editor: SceneEditor } = $props();

  const doc = $derived(editor.state);
  const playing = $derived(doc.clock.playing);
  const duration = $derived(doc.picture?.scene.duration ?? 0);

  let now = $state(0);

  /** The time under the thumb while it is held, so the playhead does not fight the drag. */
  let scrubbing = $state<number | null>(null);

  // The playhead reads the clock on every frame while it runs, and once when it stops.
  $effect(() => {
    now = performance.now();

    if (!playing) return;

    let frame = requestAnimationFrame(function tick(t) {
      now = t;
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  });

  const time = $derived.by(() => {
    if (scrubbing !== null) return scrubbing;
    const t = timeAt(doc.clock, now);

    return duration ? t % duration : t;
  });
</script>

<div class="sj-transport">
  <button
    class="sj-play"
    type="button"
    data-playing={playing || undefined}
    aria-label={playing ? "Pause" : "Play"}
    onclick={() => editor.send({ type: playing ? "pause" : "play" })}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {#if playing}
        <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" />
      {:else}
        <path d="M4 2l10 6-10 6z" />
      {/if}
    </svg>
  </button>
  <input
    class="sj-scrub"
    type="range"
    min="0"
    max={duration}
    step="any"
    aria-label="Time"
    value={time}
    disabled={!duration}
    oninput={(e) => {
      scrubbing = e.currentTarget.valueAsNumber;
      editor.send({ type: "seek", at: scrubbing });
    }}
    onchange={() => (scrubbing = null)}
  />
  <output class="sj-time">{time.toFixed(2)} / {duration.toFixed(2)}s</output>
</div>
