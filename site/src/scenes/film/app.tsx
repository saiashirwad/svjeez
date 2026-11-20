import { Icon } from "@svjeez/icons";
import { circleCheck } from "@svjeez/icons/tabler";
import {
  Group,
  line,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  exit,
  path,
  polygon,
  rect,
  span,
  track,
  typed,
  type Anim,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { ACCENTS, H, Header, SHOTS, W, geist, mono, shown, spring, theme } from "./kit";

const CARD = { x: 260, y: 196, w: 760, h: 360 } as const;
const ROW = { h: 58, pitch: 58, top: 86 } as const;
const BUTTON: Vec = [CARD.x + CARD.w - 132, CARD.y + 22];

/** The app's colors: the scene's own tokens, or one scheme's literal colors to show that scheme on its own. */
interface Ink {
  readonly card: Paint;
  readonly line: Paint;
  readonly badge: Paint;
  readonly text: Paint;
  readonly muted: Paint;
  readonly accents: readonly Paint[];
  readonly button: Paint;
  readonly onButton: Paint;
  readonly focus: Paint;
}

const tokens: Ink = {
  card: theme.background,
  line: theme.line,
  badge: theme.surface,
  text: theme.text,
  muted: theme.muted,
  accents: ACCENTS,
  button: theme.text,
  onButton: theme.background,
  focus: theme.blue,
};

const light: Ink = {
  card: "#FFFFFF",
  line: "#EBEBEB",
  badge: "#FAFAFA",
  text: "#171717",
  muted: "#666666",
  accents: ["#0070F3", "#8E4EC6", "#E93D82", "#0F9F8D"],
  button: "#171717",
  onButton: "#FFFFFF",
  focus: "#0070F3",
};

const dark: Ink = {
  card: "#0A0A0A",
  line: "#242424",
  badge: "#111111",
  text: "#EDEDED",
  muted: "#A1A1A1",
  accents: ["#3291FF", "#A475F9", "#F75F8F", "#0AC5B3"],
  button: "#EDEDED",
  onButton: "#0A0A0A",
  focus: "#3291FF",
};

const TASKS = [
  { title: "Fix loop seam", status: "Done" },
  { title: "Subset fonts", status: "Active" },
  { title: "Check contrast", status: "Todo" },
];

const ADDED = { title: "Ship dark mode", status: "Todo" };

interface RowProps {
  readonly ink: Ink;
  readonly at: Anim<Vec>;
  readonly title: string;
  readonly status: string;
  readonly dot: Paint;
  readonly motion?: Parameters<typeof Group>[0]["motion"];
}

const Row = ({ ink, at, title, status, dot, motion }: RowProps): SceneElement => (
  <Group offset={at} motion={motion}>
    <Shape geometry={rect(CARD.w - 48, ROW.h)} fill={ink.card} />
    <Shape
      geometry={line([0, ROW.h], [CARD.w - 48, ROW.h])}
      stroke={{ color: ink.line, width: 1 }}
    />
    <Shape geometry={circle(5)} at={[14, ROW.h / 2]} anchor="center" fill={dot} />
    <Text
      font={geist}
      size={22}
      letterSpacing={-0.3}
      at={[36, ROW.h / 2 + 8]}
      anchor="baseline-left"
      fill={ink.text}
    >
      {title}
    </Text>
    <Stack
      padding={[10, 5]}
      radius={6}
      fill={ink.badge}
      stroke={{ color: ink.line, width: 1 }}
      at={[CARD.w - 48, ROW.h / 2]}
      anchor="right"
    >
      <Text font={mono} size={15} fill={ink.muted}>
        {status}
      </Text>
    </Stack>
  </Group>
);

const rowAt = (i: number): Vec => [24, ROW.top + i * ROW.pitch];

interface AppProps {
  readonly ink: Ink;
  /** Played: the cursor adds a task. Still: the app as it ends, with the task added. */
  readonly played: boolean;
}

// When the app is played: the cursor clicks New, the field opens and is typed in, Add files it as a row.
const clicked = 1.7;
const opened = span(1.8, spring.settle);
const typing = span(2.3, 1.3);
const added = 4.3;

/** The button's label. */
const Label = ({
  ink,
  opacity,
  children,
}: {
  readonly ink: Ink;
  readonly opacity: Anim<number>;
  readonly children: string;
}): SceneElement => (
  <Text
    font={geist}
    weight={600}
    size={18}
    at={[54, 27]}
    anchor="baseline"
    fill={ink.onButton}
    opacity={opacity}
  >
    {children}
  </Text>
);

const App = ({ ink, played }: AppProps): SceneElement => (
  <Group offset={[CARD.x, CARD.y]}>
    <Shape
      geometry={rect(CARD.w, CARD.h, { radius: 12 })}
      fill={ink.card}
      stroke={{ color: ink.line, width: 1 }}
    />
    <Text
      font={geist}
      weight={600}
      size={26}
      letterSpacing={-0.8}
      at={[24, 54]}
      anchor="baseline-left"
      fill={ink.text}
    >
      Sprint 14
    </Text>
    <Group offset={[BUTTON[0] - CARD.x, BUTTON[1] - CARD.y]}>
      <Shape geometry={rect(108, 40, { radius: 6 })} fill={ink.button} />
      <Label
        ink={ink}
        opacity={played ? track(1).to(0, span(opened.start, 0.15)).to(1, span(added, 0.15)) : 1}
      >
        + New
      </Label>
      {played && (
        <Label
          ink={ink}
          opacity={track(0).to(1, span(opened.start, 0.15)).to(0, span(added, 0.15))}
        >
          Add
        </Label>
      )}
    </Group>
    {TASKS.map(({ title, status }, i) => (
      <Row
        ink={ink}
        at={played ? track<Vec>(rowAt(i)).to(rowAt(i + 1), opened, spring) : rowAt(i + 1)}
        title={title}
        status={status}
        dot={ink.accents[i]!}
      />
    ))}
    {played ? (
      <Group>
        <Shape
          geometry={rect(CARD.w - 48, ROW.h - 8, { radius: 6 })}
          at={[rowAt(0)[0], rowAt(0)[1] + 4]}
          stroke={{ color: ink.focus, width: 1.5 }}
          motion={[enter(span(opened.start, 0.3)), exit(span(added, 0.2))]}
        />
        <Text
          font={geist}
          size={22}
          letterSpacing={-0.3}
          at={[rowAt(0)[0] + 36, rowAt(0)[1] + ROW.h / 2 + 8]}
          anchor="baseline-left"
          fill={ink.text}
          motion={[enter(span(opened.start, 0.3)), exit(span(added, 0.2))]}
        >
          {typed(track("").to(ADDED.title, typing), {
            caret: { opacity: track(1).to(0, span(added, 0.1)) },
          })}
        </Text>
        <Row
          ink={ink}
          at={rowAt(0)}
          title={ADDED.title}
          status={ADDED.status}
          dot={ink.accents[3]!}
          motion={enter(span(added, 0.35), { from: { opacity: 0 }, curve: ease.out })}
        />
      </Group>
    ) : (
      <Row
        ink={ink}
        at={rowAt(0)}
        title={ADDED.title}
        status={ADDED.status}
        dot={ink.accents[3]!}
      />
    )}
  </Group>
);

const CURSOR = path.parse("M0 0V26l7-6.2 5 11 4.6-2-5-10.8H20Z");

const cursorAt = track<Vec>([1080, 600])
  .to([BUTTON[0] + 64, BUTTON[1] + 26], span(0.7, 0.9), ease.inOut)
  .to([BUTTON[0] + 70, BUTTON[1] + 30], span(3.6, 0.5), ease.inOut)
  .to([1080, 620], span(added + 0.4, 0.8), ease.inOut);

const Click = ({ at }: { readonly at: number }): SceneElement => (
  <Shape
    geometry={circle(22)}
    at={[BUTTON[0] + 64, BUTTON[1] + 26]}
    anchor="center"
    stroke={{ color: theme.faint, width: 1.5 }}
    scale={track(0.3).to(1.3, span(at, 0.4), ease.out)}
    opacity={track(0)
      .to(0.9, span(at, 0.05))
      .to(0, span(at + 0.05, 0.35))}
  />
);

const snaps = [
  { label: 'snap("idle")', at: 0.4 },
  { label: 'snap("typed")', at: typing.start },
  { label: 'snap("added")', at: added },
];

/** Shot 6: a small task app is used: New, a title typed in, Add. Under it, the snapshots a film is cut from. */
export const AppShot = (): SceneElement => {
  const { over } = SHOTS.app;

  return (
    <Group>
      <Header title="Film your real app." from="@svjeez/dom" over={over!} />
      <Group motion={shown(over!, 0.1)}>
        <App ink={tokens} played />
        <Click at={clicked} />
        <Click at={added - 0.1} />
        <Shape
          geometry={CURSOR}
          at={cursorAt}
          fill={theme.text}
          stroke={{ color: theme.background, width: 1.5, join: "round" }}
        />
        <Stack direction="row" gap={28} at={[W / 2, CARD.y + CARD.h + 44]} anchor="center">
          {snaps.map(({ label, at }) => (
            <Text
              font={mono}
              size={16}
              fill={track<Paint>(theme.faint).to(theme.text, span(at, 0.2))}
            >
              {label}
            </Text>
          ))}
        </Stack>
      </Group>
    </Group>
  );
};

/** The part of the frame right of x, as a clip. */
const rightOf = (x: number) => polygon([x, 0], [W, 0], [W, H], [x, H]);

const checks = ["Contrast", "No overlaps", "Clean loop", "0 B of JS"];

/** Shot 7: the same app, light on the left and dark on the right of a moving seam, then checked. */
export const ThemesShot = (): SceneElement => {
  const { over } = SHOTS.themes;
  const seam = span(0.4, 1.3);
  const close = span(3.1, 0.8);
  const left = CARD.x + CARD.w;
  const middle = CARD.x + CARD.w / 2;

  return (
    <Group>
      <Header title="Light and dark. Checked." from="tokens() · svjeez check" over={over!} />
      <Group motion={shown(over!, 0)}>
        <App ink={light} played={false} />
        <Group
          clip={track(rightOf(left))
            .to(rightOf(middle), seam, ease.inOut)
            .to(rightOf(left), close, ease.inOut)}
        >
          <App ink={dark} played={false} />
        </Group>
        <Shape
          geometry={rect(1.5, CARD.h + 40)}
          at={track<Vec>([left, CARD.y - 20])
            .to([middle, CARD.y - 20], seam, ease.inOut)
            .to([left, CARD.y - 20], close, ease.inOut)}
          fill={theme.text}
          opacity={track(0).to(1, span(0.3, 0.2)).to(0, span(close.end, 0.2))}
        />
        <Group motion={[enter(span(seam.end, 0.3)), exit(span(close.start, 0.25))]}>
          <Text
            font={mono}
            size={14}
            letterSpacing={1.2}
            at={[CARD.x, CARD.y - 16]}
            anchor="baseline-left"
            fill={theme.muted}
          >
            LIGHT
          </Text>
          <Text
            font={mono}
            size={14}
            letterSpacing={1.2}
            at={[left, CARD.y - 16]}
            anchor="baseline-right"
            fill={theme.muted}
          >
            DARK
          </Text>
        </Group>
        <Stack direction="row" gap={36} at={[W / 2, CARD.y + CARD.h + 44]} anchor="center">
          {checks.map((label, i) => (
            <Stack
              direction="row"
              gap={10}
              align="center"
              motion={enter(span(close.end + i * 0.2, 0.35), {
                from: { opacity: 0, scale: 0.7 },
                curve: ease.pop,
              })}
            >
              <Icon
                icon={circleCheck}
                size={22}
                color={theme.green}
                stroke={{ width: 1.75 }}
                draw={(piece) => track(0).to(1, span(close.end + i * 0.2 + piece * 0.1, 0.4))}
              />
              <Text font={mono} size={16} fill={theme.text}>
                {label}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Group>
    </Group>
  );
};
