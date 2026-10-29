<script lang="ts">
  import { polylinePath } from "svjeez";
  import type { Attachment } from "svelte/attachments";
  import { MediaQuery } from "svelte/reactivity";
  import first from "./first.tsx?svjeez";
  import { anchorsOf, type Anchor } from "./anchors";
  import { drag } from "./drags";
  import { moveOnBody, removePart, toScreen } from "./edit";
  import { withGene } from "./genome";
  import { H, STILL_AT, W } from "./geometry";
  import { getLab } from "./lab.svelte";
  import { loopTime } from "./preview";

  const lab = getLab();

  const anchorsAt = $derived(anchorsOf(lab.genome, lab.lay));

  /** The moment of the loop the picture shows, so the handles ride the parts as they walk, wag and melt. */
  let now = $state(STILL_AT);

  /** Under reduced motion the picture holds still, and so do the handles. */
  const reduced = new MediaQuery("prefers-reduced-motion: reduce");

  $effect(() => {
    if (reduced.current) return;

    let frame = requestAnimationFrame(function tick() {
      now = loopTime();
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  });

  /** Grab handles over the drawn parts: carry one off the specimen to remove it, or to a new place on the body. */
  const handles = $derived(
    anchorsAt(reduced.current ? STILL_AT : now).map((a) => ({
      ...a,
      at: toScreen(lab.lay, a.at),
      r: Math.max(9, a.r * lab.lay.scale),
    })),
  );

  const spine = $derived(polylinePath(lab.lay.spine.map((p) => toScreen(lab.lay, p))));

  const grabHandle = (h: Anchor) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lab.carry(
      e,
      { kind: "part", part: h.part },
      {
        slop: 0,
        over: (m) => lab.showDrop(m, h.part),
        end: (u) => {
          const vp = lab.viewPoint(u);

          if (!vp.inside) return lab.set(removePart(lab.genome, h.part, h.eyeOnBody));
          const g = moveOnBody(lab.genome, lab.lay, h.part, vp);

          if (g !== lab.genome) lab.set(g);
        },
        clear: () => lab.showDrop(),
      },
    );
  };

  /** Drag the body: sideways stretches it, up and down fattens it. */
  const stretch = (e: PointerEvent) => {
    e.preventDefault();
    const from = lab.genome;
    const px = lab.overlay!.getBoundingClientRect().width / W;
    const s0 = lab.lay.scale;
    lab.stretching = true;
    drag(e, {
      move(m) {
        const dx = (m.clientX - e.clientX) / px / s0;
        const dy = (m.clientY - e.clientY) / px / s0;
        let g = withGene(from, "length", from.length + (dx * 2) / 120);
        g = withGene(g, "girth", from.girth - dy * 0.5);

        if (g.length !== lab.genome.length || g.girth !== lab.genome.girth) lab.set(g);
      },
      end(_, cancelled) {
        lab.stretching = false;

        if (!cancelled) lab.restamp();
      },
    });
  };

  /** The overlay is what every pointer on the stage is measured against. */
  const measure: Attachment<SVGSVGElement> = (svg) => {
    lab.overlay = svg;
  };

  /** A mutation that went too far shakes the frame. */
  const shake: Attachment<HTMLElement> = (frame) => {
    if (lab.shakes)
      frame.animate([{ rotate: "0deg" }, { rotate: "-2deg" }, { rotate: "1.5deg" }, { rotate: "0deg" }], {
        duration: 380,
      });
  };
</script>

<section class="le-stage" aria-label="Specimen">
  <div class="le-fit">
    <div
      class={["le-frame", { "le-mating": lab.mating, "le-stretching": lab.stretching }]}
      {@attach shake}
    >
      <img src={lab.drawn?.src ?? first.src} alt="" width={W} height={H} />
      <svg {@attach measure} viewBox="0 0 {W} {H}" aria-hidden="true">
        <circle class="le-drop" r={lab.drop?.r ?? 0} cx={lab.drop?.x} cy={lab.drop?.y} />
        <path
          class="le-body-hit"
          role="presentation"
          d={spine}
          stroke-width={Math.max(16, lab.lay.G * lab.lay.scale)}
          onpointerdown={stretch}
        />
        <g>
          {#each handles as h (h.key)}
            <circle class="le-handle" role="presentation" cx={h.at.x} cy={h.at.y} r={h.r} onpointerdown={grabHandle(h)} />
          {/each}
        </g>
      </svg>
    </div>
  </div>
  {#if lab.error}
    <p class="le-error">{lab.error}</p>
  {/if}
</section>

<style>
  .le-stage {
    grid-area: stage;
  }

  @media (width >= 64rem) {
    .le-stage {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      min-block-size: 0;
    }
    .le-fit {
      container-type: size;
      min-block-size: 0;
    }
    .le-frame {
      inline-size: min(100cqi, 100cqb * 1.6);
    }
  }

  .le-frame {
    position: relative;
    margin-inline: auto;
    aspect-ratio: 16 / 10;
    border-radius: var(--radius);
    overflow: clip;
    background: #f4efe2;
    box-shadow:
      0 0 0 1px var(--ring),
      0 14px 36px -18px var(--shadow);
    transition: box-shadow 0.2s;
  }

  .le-frame img,
  .le-frame svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
  }

  .le-frame svg {
    touch-action: none;
  }

  .le-frame.le-mating {
    box-shadow:
      0 0 0 3px var(--hot),
      0 14px 36px -18px var(--shadow);
  }

  .le-body-hit {
    fill: none;
    stroke: transparent;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: stroke;
    cursor: grab;
  }

  .le-handle {
    fill: transparent;
    stroke: transparent;
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    cursor: grab;
  }

  @media (hover: hover) and (pointer: fine) {
    .le-frame:hover .le-handle {
      stroke: oklch(30% 0.02 60 / 0.45);
    }
    .le-handle:hover {
      fill: oklch(100% 0 none / 0.35);
    }
    .le-body-hit:hover {
      stroke: oklch(30% 0.02 60 / 0.07);
    }
  }

  .le-stretching .le-body-hit,
  .le-stretching {
    cursor: grabbing;
  }

  .le-drop {
    fill: oklch(60% 0.2 25 / 0.18);
    stroke: oklch(55% 0.2 25);
    stroke-width: 2;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }

  .le-error {
    margin: 0.5rem 0 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font: 0.8rem/1.4 var(--mono);
    color: var(--hot);
    background: color-mix(in oklch, var(--hot) 10%, transparent);
  }
</style>
