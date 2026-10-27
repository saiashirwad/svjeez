import { Picture, ease, enter, fx, motion, picture, render, type Child } from "svjeez";

const W = 680;
const H = 400;
const D = 8;

const photo = await picture.load(new URL("./nebula.jpg", import.meta.url));
const emblem = await picture.load(new URL("./emblem.svg", import.meta.url));

const C = { bg: "#0E0B16", tile: "#161224", edge: "#2A2340", label: "#8A7FB0" } as const;
const CSS = `.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}`;

const SIZE = 140;

function Slot({ x, y, width = SIZE, label, at, children }: { x: number; y: number; width?: number; label: string; at: number; children: Child }) {
  return (
    <g animation={enter({ at, over: 0.6 }, { y: 10 })}>
      <rect x={x} y={y} width={width} height={SIZE} fill={C.tile} stroke={C.edge} />
      {children}
      <text x={x} y={y + SIZE + 18} class="mono" fontSize={11} letterSpacing={1.5} fill={C.label}>
        {label}
      </text>
    </g>
  );
}

const pan = motion({ scale: 1, x: 0 }).to({ scale: 1.35, x: -24 }, D / 2, ease.inOut).to({ scale: 1, x: 0 }, D / 2, ease.inOut);

export default function build(): string {
  return render(
    { width: W, height: H, duration: D, title: "Embedded images", desc: "A nebula photo in three fit modes, an SVG emblem with rounded corners and a shadow, duotone and grayscale treatments, and a slow pan-zoom inside a fixed frame.", css: CSS },
    <>
      <rect width={W} height={H} fill={C.bg} />
      <Slot x={30} y={30} label="COVER" at={0}>
        <Picture src={photo} x={30} y={30} width={SIZE} height={SIZE} fit="cover" alt="A nebula, cropped to fill the frame" />
      </Slot>
      <Slot x={190} y={30} label="CONTAIN" at={0.15}>
        <Picture src={photo} x={190} y={30} width={SIZE} height={SIZE} fit="contain" alt="A nebula, letterboxed" />
      </Slot>
      <Slot x={350} y={30} label="FILL" at={0.3}>
        <Picture src={photo} x={350} y={30} width={SIZE} height={SIZE} fit="fill" alt="A nebula, stretched" />
      </Slot>
      <Slot x={510} y={30} label="SVG + SHADOW" at={0.45}>
        <Picture src={emblem} x={510} y={30} width={SIZE} radius={24} filter={fx.shadow({ dy: 6, blur: 7, opacity: 0.6 })} alt="A sun over mountains" />
      </Slot>
      <Slot x={30} y={220} label="DUOTONE" at={0.6}>
        <Picture src={photo} x={30} y={220} width={SIZE} height={SIZE} filter={fx.duotone({ dark: "#1B1464", light: "#FFB36B" })} alt="The nebula in indigo and amber" />
      </Slot>
      <Slot x={190} y={220} label="GRAYSCALE" at={0.75}>
        <Picture src={photo} x={190} y={220} width={SIZE} height={SIZE} filter={fx.grayscale()} alt="The nebula in gray" />
      </Slot>
      <Slot x={350} y={220} width={300} label="KEN BURNS" at={0.9}>
        <Picture src={photo} x={350} y={220} width={300} height={SIZE} radius={14} animation={pan} alt="A slow pan and zoom across the nebula" />
      </Slot>
    </>,
  );
}
