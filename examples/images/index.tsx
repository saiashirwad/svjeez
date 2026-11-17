import {
  Picture,
  type Color,
  ease,
  enter,
  fx,
  motion,
  picture,
  render,
  span,
  type PictureProps,
} from "svjeez";

import {
  HEIGHT,
  MARGIN,
  WIDTH,
  color,
  css,
  duotone,
  geist,
  hue,
  leave,
  size,
  wash,
} from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;
const D = 10;

const photo = await picture.load(new URL("./hills.jpg", import.meta.url));
const emblem = await picture.load(new URL("./emblem.svg", import.meta.url));

const SIZE = 168;
const GAP = (W - 2 * MARGIN - 4 * SIZE) / 3;
const col = (i: number) => MARGIN + i * (SIZE + GAP);
const ROW = [64, 64 + SIZE + 58] as const;

function Slot({
  label,
  at,
  tint,
  ...picture
}: PictureProps & { label: string; at: number; tint: Color }) {
  const { x = 0, y = 0, width = SIZE } = picture;

  return (
    <g animation={enter({ at, over: 0.5 }, { opacity: 0, y: 8 }, ease.out)}>
      <rect x={x} y={y} width={width} height={SIZE} fill={color.panel} />
      <rect
        x={x}
        y={y}
        width={width}
        height={SIZE}
        {...wash(tint, 0.14)}
        stroke={tint}
        strokeOpacity={0.5}
      />
      <Picture {...picture} width={width} height={SIZE} />
      <text x={x} y={y + SIZE + 20} fontFamily={geist} fontSize={size.label} fill={color.dim}>
        {label}
      </text>
    </g>
  );
}

const pan = motion({ scale: 1, x: 0 })
  .to({ scale: 1.35, x: -24 }, span(0.5, (D - 2.6) / 2), ease.inOut)
  .to({ scale: 1, x: 0 }, span(0.5, (D - 2.6) / 2).next((D - 2.6) / 2), ease.inOut);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Image treatments",
      desc: "A landscape image in three fit modes, an SVG badge with rounded corners and a shadow, duotone and grayscale treatments, and a slow pan and zoom inside a fixed frame.",
      css,
    },
    <>
      <rect width={W} height={H} fill={color.bg} />
      <g animation={leave(D)}>
        <Slot
          tint={hue.blue}
          x={col(0)}
          y={ROW[0]}
          label="Cover"
          at={0.1}
          src={photo}
          fit="cover"
          alt="Hills at dusk, cropped to fill the frame"
        />
        <Slot
          tint={hue.orange}
          x={col(1)}
          y={ROW[0]}
          label="Contain"
          at={0.2}
          src={photo}
          fit="contain"
          alt="Hills at dusk, letterboxed"
        />
        <Slot
          tint={hue.purple}
          x={col(2)}
          y={ROW[0]}
          label="Fill"
          at={0.3}
          src={photo}
          fit="fill"
          alt="Hills at dusk, stretched"
        />
        <Slot
          tint={hue.blue}
          x={col(3)}
          y={ROW[0]}
          label="Rounded with shadow"
          at={0.4}
          src={emblem}
          radius={24}
          filter={fx.shadow({ dy: 6, blur: 7, opacity: 0.6 })}
          alt="A star in a ring on a green badge"
        />
        <Slot
          tint={hue.orange}
          x={col(0)}
          y={ROW[1]}
          label="Duotone"
          at={0.5}
          src={photo}
          filter={fx.duotone(duotone)}
          alt="The hills in blue and yellow"
        />
        <Slot
          tint={hue.purple}
          x={col(1)}
          y={ROW[1]}
          label="Grayscale"
          at={0.6}
          src={photo}
          filter={fx.grayscale()}
          alt="The hills in gray"
        />
        <Slot
          tint={hue.blue}
          x={col(2)}
          y={ROW[1]}
          width={2 * SIZE + GAP}
          label="Slow pan and zoom"
          at={0.7}
          src={photo}
          radius={8}
          animation={pan}
          alt="A slow pan and zoom across the hills"
        />
      </g>
    </>,
  );
}
