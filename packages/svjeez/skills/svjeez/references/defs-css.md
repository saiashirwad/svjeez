# Defs, CSS properties and filters

## Defs

`def.<kind>(attrs, children)` makes a gradient, pattern, clip path, mask, filter, marker or symbol. Pass the returned ref itself as the attribute value. Never write a string or `url(#id)`. `render` emits a def only when something uses it, with a generated id.

```tsx
import { def, fx, render } from "svjeez";

const fade = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, <><stop offset={0} stopColor="#fff" /><stop offset={1} stopColor="#fff" stopOpacity={0} /></>);
const round = def.clipPath({}, <circle cx={50} cy={50} r={40} />);
const card = <rect width={100} height={100} fill={fade} clipPath={round} />;
```

A ref in the wrong slot is a type error: a gradient is not a clip path. `stop` animates `stopColor` and `stopOpacity`. A `symbol` is for geometry drawn more than once: build it once and `<use href={symbol} />` it as often as you like.

```tsx
const dot = def.symbol({ style: "overflow:visible" }, <circle r={4} />);
const dots = [0, 1, 2].map((i) => <use href={dot} x={20 + i * 12} y={20} />);
```

## Custom properties

`def.property(name, { syntax, inherits, initial })` registers a typed CSS custom property. `syntax` is `number`, `length`, `angle` or `color`. The returned key animates like a channel on any tag except filter primitives, and works in `style` and in `css`.

```tsx
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const reach = def.property("reach", { syntax: "number", inherits: false, initial: 0 });

const orbit = render(
  {
    width: 200,
    height: 200,
    duration: 4,
    title: "Orbit",
    css: css`
      .dot {
        translate: calc(100px + 60px * ${reach} * cos(${yaw})) 100px;
      }
    `,
  },
  <g animation={motion().to({ [yaw]: 360 }, 4, ease.linear)}>
    <circle class="dot" r={6} style={{ [reach]: 1 }} />
  </g>,
);
```

Animate an angle on a parent and let children read it with `cos` and `sin` in `calc`. This is how one motion drives many elements with different phases.

## calc

`calc` builds CSS expressions and checks units: a length times a length is a type error, and `cos` takes an angle.

```tsx
const { add, mul, div, sin, cos, length } = calc;

const slide = css`.dot { translate: ${add(length(100), mul(length(60), reach, cos(yaw)))} 100px }`;
const depth = add(mul(reach, sin(yaw)), mul(reach, cos(yaw)));
const shrink = css`.dot { scale: ${div(720, add(720, depth))} }`;
```

Also `sub`, `clamp`, `angle`, `min` and `max`.

## Filters

```tsx
const glow = <text filter={fx.glow({ blur: 4 })}>OPEN</text>;
const boil = <g filter={fx.boil({ strength: 2, rate: 10 })}>{glow}</g>;
```

| Filter | Does |
| --- | --- |
| `fx.glow({ blur })` | Neon bloom: a blurred copy merged under the source |
| `fx.boil({ strength, rate, seed, detail })` | Hand-drawn wobble from stepped turbulence |
| `fx.grayscale({ amount })` | 1 is fully gray, 0 leaves the source alone |
| `fx.duotone({ dark, light })` | Maps luminance onto a ramp. Hex colors only |
| `fx.blur(deviation)` | Gaussian blur, standard deviation in px |
| `fx.shadow({ dx, dy, blur, color, opacity })` | Drop shadow |

To animate a filter, build it with `def.filter` and put `animation` on its primitive. Primitives take `stdDeviation`, `baseFrequency`, `seed`, `displace`, `dx`, `dy`, `floodColor` and `floodOpacity`, compiled to SMIL.

```tsx
const pulse = def.filter({}, <feGaussianBlur stdDeviation={0} animation={motion({ stdDeviation: 0 }).to({ stdDeviation: 6 }, 1).to({ stdDeviation: 0 }, 1).loop(2)} />);
const lit = <circle r={10} filter={pulse} />;
```

A filter over many animated elements re-renders every frame. `validateSvg` warns past 40. Paint a glow with a gradient, or filter something that holds still.
