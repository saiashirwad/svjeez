<script lang="ts">
  import { getBench } from "./bench.svelte";
  import { flashOnChange } from "./flash";
  import { bytes, fmt } from "./view";

  const bench = getBench();
  const status = $derived(bench.status);
</script>

<div class="transport">
  <button
    class="play"
    type="button"
    aria-label={bench.frozen === undefined ? "Pause" : "Play"}
    onclick={bench.toggle}
  >
    <span class={["icon", { paused: bench.frozen !== undefined }]}></span>
  </button>
  <output class="clock">{fmt(bench.time)}</output>
  <p class="stats" aria-live="off">
    {#if status?.ok}
      <span class="stat">
        <b {@attach flashOnChange(`${status.gzip}|${status.keyframes}`, true)}>{bytes(status.gzip)}</b>
        gzip
      </span>
      <span class="stat"><b>{status.keyframes}</b> keyframes</span>
      <span class="stat"><b>0 B</b> JS</span>
      <span class="stat"><b>{status.ms.toFixed(1)} ms</b> to build</span>
    {:else if status}
      {status.message}
    {/if}
  </p>
</div>

<style>
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
  }
  .play {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border: 0;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    cursor: pointer;
  }
  .play:active {
    scale: 0.96;
  }
  .play:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .icon {
    inline-size: 10px;
    block-size: 12px;
    border-inline: 3.5px solid currentColor;
  }
  .icon.paused {
    inline-size: 0;
    block-size: 0;
    border-block: 7px solid transparent;
    border-inline: 11px solid currentColor;
    border-inline-end: 0;
    margin-inline-start: 3px;
  }
  .clock {
    font: 600 0.95rem / 1 var(--mono);
    font-variant-numeric: tabular-nums;
    min-inline-size: 4.5ch;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    margin-inline-start: auto;
    color: var(--muted);
    font-size: 0.82rem;
  }
  .stat b {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
</style>
