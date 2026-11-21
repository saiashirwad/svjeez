import {
  Group,
  Sequence,
  Shape,
  Text,
  arc,
  clock,
  ease,
  line,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

// The field and the button are driven by separate state regions, so each has its own clocks.
const focus = clock("focus", span(0.4, 0.3));
const verdict = clock("verdict", span(0.9, 0.8));
const ready = clock("ready", span(1.8, 0.3));
const send = clock("send", span(2.2, 1.2));

// The machines page inlines several scenes, so each keeps its ids to itself.
export const prefix = "form-";

const FIELD = rect(320, 48, { radius: 12 });

export default scene(
  {
    size: [400, 300],
    duration: 3.5,
    title: "Sign-up form",
    desc: "A sign-up card with two independent regions. The email field's border turns blue while typing, then green with a check mark or red with an error; the button wakes when the email is valid, spins while sending and turns into a check. XState decides the state; page code only tells the view where each clock rests.",
    theme,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Text font={geist} weight={600} size={20} at={[200, 54]} anchor="baseline" fill={theme.text}>
        Create account
      </Text>
      <Group hit="field" offset={[40, 76]}>
        <Shape geometry={FIELD} fill={theme.surface} stroke={{ color: theme.raised, width: 1.5 }} />
        <Sequence clock={focus}>
          <Shape
            geometry={FIELD}
            stroke={{ color: theme.blue, width: 2 }}
            opacity={track(0).to(1, span(0, 0.3))}
          />
        </Sequence>
        <Sequence clock={verdict}>
          <Shape
            geometry={FIELD}
            stroke={{ color: theme.green, width: 2 }}
            opacity={track(0).to(1, span(0, 0.1)).to(0, span(0.4, 0.2))}
          />
          <Shape
            geometry={line([288, 25], [295, 32], [307, 17])}
            stroke={{ color: theme.green, width: 3, cap: "round", join: "round" }}
            trim={track<Vec>([0, 0]).to([0, 1], span(0.05, 0.35), ease.out)}
            opacity={track(1).to(0, span(0.4, 0.2))}
          />
          <Shape
            geometry={FIELD}
            stroke={{ color: theme.red, width: 2 }}
            opacity={track(0).to(1, span(0.4, 0.3))}
          />
          <Text
            font={geist}
            size={12}
            at={[0, 72]}
            anchor="baseline-left"
            fill={theme.red}
            opacity={track(0).to(1, span(0.5, 0.3))}
          >
            Enter an email like you@example.com
          </Text>
        </Sequence>
      </Group>
      <Group hit="submit" offset={[40, 176]}>
        <Sequence clock={ready}>
          <Shape
            geometry={rect(320, 48, { radius: 12 })}
            fill={theme.blue}
            opacity={track(0.35).to(1, span(0, 0.3))}
          />
        </Sequence>
        <Sequence clock={send}>
          <Shape
            geometry={rect(320, 48, { radius: 12 })}
            fill={theme.green}
            opacity={track(0).to(1, span(0.7, 0.3))}
          />
          <Text
            font={geist}
            weight={600}
            size={15}
            at={[160, 29]}
            anchor="baseline"
            fill={theme.background}
            opacity={track(1).to(0, span(0, 0.25))}
          >
            Sign up
          </Text>
          <Shape
            geometry={arc({ radius: 10, sweep: 270 })}
            at={[160, 24]}
            anchor="center"
            stroke={{ color: theme.background, width: 3, cap: "round" }}
            rotate={track(0).to(540, span(0, 0.6), ease.linear)}
            opacity={track(0).to(1, span(0, 0.25)).to(0, span(0.6, 0.2))}
          />
          <Shape
            geometry={line([146, 25], [155, 34], [172, 15])}
            stroke={{ color: theme.background, width: 3, cap: "round", join: "round" }}
            trim={track<Vec>([0, 0]).to([0, 1], span(0.8, 0.4), ease.out)}
          />
        </Sequence>
      </Group>
    </Group>
  ),
);
