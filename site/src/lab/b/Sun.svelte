<script lang="ts">
  import { drag } from "./attach";
  import { isDay, skyAt } from "./feel";
  import Instrument from "./Instrument.svelte";
  import { getLab } from "./feel-state.svelte";

  const CX = 130;
  const CY = 124;
  const R = 92;
  const STARS = Array.from({ length: 18 }, (_, i) => i);

  const lab = getLab();
  const feel = $derived(lab.feel);

  // Sun angle: π at 6:00 (left horizon), π/2 at noon, 0 at 18:00.
  const angle = $derived(Math.PI - ((feel.hour - 6) / 12) * Math.PI);

  const time = $derived.by(() => {
    const h = Math.floor(feel.hour);
    const m = Math.round((feel.hour - h) * 60) % 60;

    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  });

  const hourOf = (a: number) => (((6 + ((Math.PI - a) / Math.PI) * 12) % 24) + 24) % 24;

  const grab = (offset: number) =>
    drag({
      move: (p) =>
        lab.update({ hour: hourOf(Math.atan2(CY - p.y, p.x - CX) - offset) }),
    });

  const keys = {
    ArrowLeft: () => lab.update({ hour: (feel.hour + 23.5) % 24 }),
    ArrowRight: () => lab.update({ hour: (feel.hour + 0.5) % 24 }),
  };
</script>

<Instrument
  name="sun"
  title="Hour"
  hint="Drag the sun across the day, or the moon across the night."
  box="0 0 260 160"
  readout={time}
  clip
  {keys}
>
  <rect width="260" height="160" rx="0" fill={skyAt(feel.hour)} />
  <g class="stars" style:opacity={isDay(feel.hour) ? 0 : 1}>
    {#each STARS as i (i)}
      <circle cx={((i * 73) % 250) + 5} cy={((i * 37) % 100) + 8} r={i % 3 ? 0.8 : 1.3} />
    {/each}
  </g>
  <circle cx={CX} cy={CY} r={R} class="orbit" />
  <circle
    r="13"
    fill="#FFD60A"
    class="grab"
    cx={CX + R * Math.cos(angle)}
    cy={CY - R * Math.sin(angle)}
    {@attach grab(0)}
  />
  <circle
    r="9"
    fill="#F4F1E6"
    class="grab"
    cx={CX - R * Math.cos(angle)}
    cy={CY + R * Math.sin(angle)}
    {@attach grab(Math.PI)}
  />
  <path d="M0 {CY}Q60 {CY - 18} 120 {CY}T260 {CY - 6}V160H0Z" fill="#1B1B2F" />
  <text x="250" y="150" class="clock" text-anchor="end">{time}</text>
</Instrument>

<style>
  .orbit {
    fill: none;
    stroke: oklch(100% 0 none / 0.45);
    stroke-dasharray: 2 4;
  }

  .stars {
    fill: #fff;
    transition: opacity 0.4s;
  }

  .clock {
    fill: #fff;
    font: 600 12px var(--mono);
  }
</style>
