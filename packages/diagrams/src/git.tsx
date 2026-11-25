/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  line,
  path,
  rect,
  span,
  through,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child } from "svjeez/tools";
import {
  checkDraws,
  checkIds,
  drawnBy,
  edgeKey,
  extent,
  fade,
  known,
  look,
  mix,
  partsOf,
  pop,
  schedule,
  type Diagram,
  type DiagramOptions,
  type Reveal,
} from "./kit.tsx";
import { series } from "./series.ts";

export type GitKind = "normal" | "reverse" | "highlight" | "merge" | "cherry-pick";

export interface GitCommit<B extends string = string> {
  readonly id: string;
  readonly branch: B;
  readonly kind?: GitKind;
  /** Earlier commit ids. The first continues the commit's own branch (or the branch it starts from); the others are merged or cherry-picked in. */
  readonly parents?: readonly string[];
  /** Written under the dot. */
  readonly label?: string;
  readonly tags?: readonly string[];
}

export interface GitGraphOptions extends DiagramOptions {
  /** "LR" (the default) runs time left to right with a row per branch; "TB" and "BT" run it down or up with a column per branch. */
  readonly direction?: "LR" | "TB" | "BT";
  /** Drawn above the graph. */
  readonly title?: string;
  readonly reveal?: Reveal<string>;
}

/** Its parts are the branches, the commits by id, and the lines between them by "parent->commit". */
export type GitGraph = Diagram<string>;

const WHAT = "gitGraph()";
const KINDS: readonly GitKind[] = ["normal", "reverse", "highlight", "merge", "cherry-pick"];
const DOT = 7;
const STEP = 44;
const TURN = 36;

const round = (value: number): number => Math.round(value * 100) / 100;

export function gitGraph<const B extends Record<string, string>>(
  spec: { readonly branches: B; readonly commits: readonly GitCommit<NoInfer<keyof B & string>>[] },
  options: GitGraphOptions,
): GitGraph {
  const l = look(options, WHAT);
  const { direction = "LR" } = options;

  if (direction !== "LR" && direction !== "TB" && direction !== "BT")
    throw new SceneError(`${WHAT} takes direction "LR", "TB" or "BT", got "${String(direction)}".`);
  const vertical = direction !== "LR";
  const lanes = Object.entries<string>(spec.branches).map(([id, label]) => ({ id, label }));
  const laneIds = lanes.map((b) => b.id);
  checkIds(laneIds, WHAT, "branch");
  const commits = spec.commits;
  const ids = commits.map((c) => c.id);

  if (commits.length > 0) checkIds(ids, WHAT, "commit");
  const taken = new Set<string>(laneIds);
  const byId = new Map<string, number>();

  commits.forEach((c, i) => {
    known(c.branch, laneIds, WHAT, "branch", `commit "${c.id}"`);

    if (taken.has(c.id))
      throw new SceneError(
        `${WHAT} has the name "${c.id}" twice, as ${byId.has(c.id) ? "two commits" : "a branch and a commit"}.`,
        "Name each branch and commit differently.",
      );
    taken.add(c.id);
    byId.set(c.id, i);

    if (!KINDS.includes(c.kind ?? "normal"))
      throw new SceneError(
        `${WHAT} commit "${c.id}" has the kind "${String(c.kind)}".`,
        `Use one of ${KINDS.map((k) => `"${k}"`).join(", ")}.`,
      );

    for (const p of c.parents ?? [])
      if (!(byId.get(p) !== undefined && byId.get(p)! < i))
        throw new SceneError(
          `${WHAT} commit "${c.id}" has the parent "${p}", which is not a commit before it.`,
          "List commits oldest first, and name only earlier commits as parents.",
        );
  });

  const small = l.small;
  const tagH = Math.round(small * 1.7);
  const labelH = Math.round(small * 1.5);

  const wide = (c: GitCommit): number =>
    Math.max(
      c.label === undefined ? 0 : l.measure(c.label, small),
      ...(c.tags ?? []).map((t) => l.measure(t, small) + 12),
    );

  const pills = lanes.map((b) => ({
    ...b,
    w: Math.round(l.measure(b.label, l.size, l.weight) + 20),
    h: Math.round(l.size * 1.8),
  }));

  const pad = 8;
  const last = commits.length - 1;
  const bar = Math.max(0, ...pills.map((p) => p.h));
  const column = Math.max(0, ...pills.map((p) => p.w));
  const tagGap = 6;

  const us: number[] = [];
  const vs: number[] = [];
  let [timeLength, laneLength, trackFrom] = [0, 0, 0];

  const side = (c: GitCommit): number =>
    (c.label === undefined ? 0 : l.measure(c.label, small) + tagGap) +
    (c.tags ?? []).reduce((sum, t) => sum + l.measure(t, small) + 12 + tagGap, 0);

  if (vertical) {
    trackFrom = pad + bar + 8;
    commits.forEach((c, i) =>
      us.push(i === 0 ? trackFrom + 26 : us[i - 1]! + Math.max(34, tagH + 8)),
    );
    timeLength = Math.ceil((us.at(-1) ?? trackFrom) + DOT + pad * 2);

    const reach = lanes.map((b, i) =>
      Math.max(
        pills[i]!.w / 2,
        DOT + 6 + Math.max(0, ...commits.filter((c) => c.branch === b.id).map(side)),
      ),
    );

    lanes.forEach((_, i) => {
      const left = Math.max(pills[i]!.w / 2, DOT);
      vs.push(i === 0 ? pad + left : vs[i - 1]! + reach[i - 1]! + left + 12);
    });
    laneLength = Math.ceil(vs.at(-1)! + reach.at(-1)! + pad);
  } else {
    const xs: number[] = [];

    commits.forEach((c, i) => {
      xs.push(
        i === 0
          ? column + 36
          : xs[i - 1]! + Math.max(STEP, (wide(commits[i - 1]!) + wide(c)) / 2 + 14),
      );
    });

    const rows = lanes.map((b) => {
      const own = commits.filter((c) => c.branch === b.id);

      return {
        above: DOT + 6 + Math.max(0, ...own.map((c) => (c.tags?.length ?? 0) * (tagH + 3))),
        below: DOT + 6 + (own.some((c) => c.label !== undefined) ? labelH : 0),
      };
    });

    const ys: number[] = [];

    rows.forEach((r, i) => {
      ys.push(
        i === 0
          ? r.above
          : Math.max(ys[i - 1]! + 46, ys[i - 1]! + rows[i - 1]!.below + r.above + 4),
      );
    });

    us.push(...xs.map((x) => x + pad));
    vs.push(...ys.map((y) => y + pad));
    trackFrom = column + pad + 8;

    timeLength = Math.ceil(
      Math.max(column, (xs[last] ?? 0) + (last >= 0 ? wide(commits[last]!) / 2 : 0) + DOT) +
        pad * 2,
    );
    laneLength = Math.ceil((ys.at(-1) ?? 0) + (rows.at(-1)?.below ?? 0) + pad);
  }

  const [width, bodyHeight] = vertical ? [laneLength, timeLength] : [timeLength, laneLength];
  const head = options.title === undefined ? 0 : Math.round(l.size * 1.6) + 8;
  const height = bodyHeight + head;

  const place = (u: number, v: number): { x: number; y: number } =>
    direction === "LR" ? { x: u, y: v } : { x: v, y: direction === "TB" ? u : bodyHeight - u };

  const laneAt = new Map(laneIds.map((id, i) => [id, i]));
  const at = commits.map((c, i) => place(us[i]!, vs[laneAt.get(c.branch)!]!));
  const tint = (branch: string) => series(l, laneAt.get(branch)!);

  const order: string[] = [];
  const started = new Set<string>();

  for (const c of commits) {
    if (!started.has(c.branch)) {
      started.add(c.branch);
      order.push(c.branch);
    }

    order.push(c.id);
  }

  order.push(...laneIds.filter((id) => !started.has(id)));
  const shown = schedule(options.reveal, order, WHAT);

  const links = commits.flatMap((c, i) =>
    (c.parents ?? []).map((p, j) => ({ from: p, to: c.id, a: at[byId.get(p)!]!, b: at[i]!, j, c })),
  );

  const drawn = (from: string, to: string): Span | undefined => {
    const [a, b] = [shown.get(from), shown.get(to)];

    if (!a && !b) return undefined;
    const over = Math.min(0.35, (b ?? a)!.over);

    return span(Math.max(0, a?.start ?? 0, b ? b.start - over : 0), over);
  };

  checkDraws(
    options.draw,
    links.map((k) => edgeKey(k.from, k.to)),
    WHAT,
  );

  const parts = new Map<string, Span | undefined>([
    ...order.map((id) => [id, shown.get(id)] as const),
    ...links.map((k) => [edgeKey(k.from, k.to), drawn(k.from, k.to)] as const),
  ]);

  const handle = partsOf<string>(WHAT, parts);

  const route = (k: (typeof links)[number]) => {
    const [i, j] = [byId.get(k.from)!, byId.get(k.to)!];
    const home = commits[i]!.branch;
    const [from, to] = [vs[laneAt.get(home)!]!, vs[laneAt.get(k.c.branch)!]!];
    const [u0, u1] = [us[i]!, us[j]!];
    const turn = Math.min(TURN, (u1 - u0) * 0.9);

    const point = (u: number, v: number): Vec => {
      const p = place(u, v);

      return [round(p.x), round(p.y)];
    };

    if (from === to) return path().moveTo(point(u0, from)).lineTo(point(u1, to));

    if (k.j === 0)
      return path()
        .moveTo(point(u0, from))
        .curveTo(point(u0 + turn / 2, from), point(u0 + turn / 2, to), point(u0 + turn, to))
        .lineTo(point(u1, to));

    return path()
      .moveTo(point(u0, from))
      .lineTo(point(u1 - turn, from))
      .curveTo(point(u1 - turn / 2, from), point(u1 - turn / 2, to), point(u1, to));
  };

  const symbol = (c: GitCommit, color: ReturnType<typeof tint>) => {
    const ground = { color: l.colors.background, width: 2 };
    const cross = { color: l.colors.background, width: 1.5, cap: "round" as const };

    switch (c.kind ?? "normal") {
      case "highlight":
        return (
          <Shape
            key="dot"
            geometry={rect(DOT * 2 + 1, DOT * 2 + 1, { radius: 2 })}
            anchor="center"
            at={[0, 0]}
            fill={color}
            stroke={ground}
          />
        );
      case "merge":
        return (
          <Group key="dot">
            <Shape
              geometry={circle(DOT - 1)}
              anchor="center"
              at={[0, 0]}
              fill={l.colors.background}
              stroke={{ color, width: 2 }}
            />
            <Shape geometry={circle(2.5)} anchor="center" at={[0, 0]} fill={color} />
          </Group>
        );
      case "reverse":
        return (
          <Group key="dot">
            <Shape
              geometry={circle(DOT)}
              anchor="center"
              at={[0, 0]}
              fill={color}
              stroke={ground}
            />
            <Shape geometry={line([-3, -3], [3, 3])} stroke={cross} />
            <Shape geometry={line([-3, 3], [3, -3])} stroke={cross} />
          </Group>
        );
      case "cherry-pick":
        return (
          <Group key="dot">
            <Shape
              geometry={circle(DOT)}
              anchor="center"
              at={[0, 0]}
              fill={color}
              stroke={ground}
            />
            <Shape geometry={line([0, -4], [0, 0.5])} stroke={cross} />
            <Shape
              geometry={circle(1.3)}
              anchor="center"
              at={[-2.5, 2.5]}
              fill={l.colors.background}
            />
            <Shape
              geometry={circle(1.3)}
              anchor="center"
              at={[2.5, 2.5]}
              fill={l.colors.background}
            />
          </Group>
        );
      case "normal":
        return (
          <Shape
            key="dot"
            geometry={circle(DOT)}
            anchor="center"
            at={[0, 0]}
            fill={color}
            stroke={ground}
          />
        );
    }
  };

  const tagPill = (t: string, color: ReturnType<typeof tint>, key: string, offset: Vec) => {
    const w = Math.round(l.measure(t, small) + 12);

    return (
      <Group key={key} offset={offset}>
        <Shape
          geometry={rect(w, tagH, { radius: tagH / 2 })}
          fill={mix(color, l.colors.background, 0.16)}
          stroke={{ color, width: 1 }}
        />
        <Text
          font={l.font}
          size={small}
          fill={l.colors.text}
          anchor="center"
          at={[w / 2, tagH / 2]}
        >
          {t}
        </Text>
      </Group>
    );
  };

  const beneath = (c: GitCommit, color: ReturnType<typeof tint>): SceneElement[] => [
    ...(c.label === undefined
      ? []
      : [
          <Group key="label" offset={[0, DOT + 4]}>
            <Shape
              geometry={rect(l.measure(c.label, small) + 6, labelH, { radius: 3 })}
              at={[round(-(l.measure(c.label, small) + 6) / 2), 0]}
              fill={l.colors.background}
            />
            <Text
              font={l.font}
              size={small}
              fill={l.colors.muted}
              anchor="center"
              at={[0, labelH / 2]}
            >
              {c.label}
            </Text>
          </Group>,
        ]),
    ...(c.tags ?? []).map((t, n) =>
      tagPill(t, color, `tag-${n}`, [
        round(-(l.measure(t, small) + 12) / 2),
        -DOT - 6 - tagH - n * (tagH + 3),
      ]),
    ),
  ];

  const aside = (c: GitCommit, color: ReturnType<typeof tint>): SceneElement[] => {
    const text = c.label === undefined ? 0 : l.measure(c.label, small) + tagGap;
    let x = DOT + 6 + text;

    return [
      ...(c.label === undefined
        ? []
        : [
            <Text
              key="label"
              font={l.font}
              size={small}
              fill={l.colors.muted}
              anchor="left"
              at={[DOT + 6, 0]}
            >
              {c.label}
            </Text>,
          ]),
      ...(c.tags ?? []).map((t, n) => {
        const at = x;
        x += l.measure(t, small) + 12 + tagGap;

        return tagPill(t, color, `tag-${n}`, [round(at), round(-tagH / 2)]);
      }),
    ];
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {options.title !== undefined && (
        <Text
          key="title"
          font={l.font}
          size={l.size}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[width / 2, Math.round(l.size * 0.9)]}
        >
          {options.title}
        </Text>
      )}
      <Group key="body" offset={[0, head]}>
        {lanes.map((b, i) => {
          const when = shown.get(b.id);
          const p = pills[i]!;
          const color = tint(b.id);
          const v = vs[i]!;

          const corner: [number, number] = !vertical
            ? [pad, round(v - p.h / 2)]
            : [round(v - p.w / 2), direction === "TB" ? pad : bodyHeight - pad - p.h];

          const rail = vertical
            ? line(
                [v, round(place(trackFrom, v).y)],
                [v, direction === "TB" ? bodyHeight - pad : pad],
              )
            : line([trackFrom, v], [width, v]);

          return (
            <Group key={b.id} opacity={when && fade(when)}>
              <Shape
                key="track"
                geometry={rail}
                stroke={{ color: mix(color, l.colors.background, 0.45), width: 1, dash: [3, 4] }}
              />
              <Group key="pill" offset={corner}>
                <Shape geometry={rect(p.w, p.h, { radius: 5 })} fill={color} />
                <Text
                  font={l.font}
                  size={l.size}
                  weight={l.weight}
                  fill={l.colors.background}
                  anchor="center"
                  at={[p.w / 2, p.h / 2]}
                >
                  {b.label}
                </Text>
              </Group>
            </Group>
          );
        })}
        {links.map((k) => {
          const id = edgeKey(k.from, k.to);
          const progress = drawnBy(options.draw, id, drawn(k.from, k.to), WHAT);
          const home = commits[byId.get(k.from)!]!.branch;
          const fork = k.j === 0 && home !== k.c.branch;

          return (
            <Shape
              key={id}
              geometry={route(k)}
              stroke={{
                color: tint(fork || k.j === 0 ? k.c.branch : home),
                width: 2.5,
                cap: "round",
                join: "round",
                dash: k.c.kind === "cherry-pick" && k.j > 0 ? [4, 3] : undefined,
              }}
              trim={
                progress === undefined || (k.c.kind === "cherry-pick" && k.j > 0)
                  ? undefined
                  : through(progress, (d): Vec => [0, d])
              }
              opacity={
                progress !== undefined && k.c.kind === "cherry-pick" && k.j > 0
                  ? progress
                  : undefined
              }
            />
          );
        })}
        {between}
        {commits.map((c, i) => {
          const when = shown.get(c.id);
          const p = at[i]!;
          const color = tint(c.branch);

          return (
            <Group key={c.id} offset={[round(p.x), round(p.y)]} motion={when && pop(when)}>
              {symbol(c, color)}
              {vertical ? aside(c, color) : beneath(c, color)}
            </Group>
          );
        })}
      </Group>
    </Group>
  );

  return {
    node: draw(),
    with: draw,
    size: [width, height],
    span: extent([...parts.values()]),
    ...handle,
  };
}
