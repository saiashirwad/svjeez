/** @jsxImportSource react */
import {
  Check,
  CircleDashed,
  FileText,
  FolderPlus,
  Inbox,
  LayoutGrid,
  Plus,
  Search,
  SquarePen,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useReducer, type ReactNode } from "react";
import "./board.css";

type Status = "todo" | "progress" | "done";

type Label = "Bug" | "Feature" | "Polish";

interface Person {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly hue: number;
}

interface Issue {
  readonly id: string;
  readonly title: string;
  readonly label: Label;
  readonly who: string;
  readonly status: Status;
  readonly rank: number;
}

const PEOPLE: readonly Person[] = [
  { id: "mara", name: "Mara", initials: "MA", hue: 28 },
  { id: "jonas", name: "Jonas", initials: "JO", hue: 200 },
  { id: "priya", name: "Priya", initials: "PR", hue: 330 },
  { id: "kit", name: "Kit", initials: "KT", hue: 140 },
];

const COLUMNS: readonly { readonly status: Status; readonly name: string }[] = [
  { status: "todo", name: "Todo" },
  { status: "progress", name: "In progress" },
  { status: "done", name: "Done" },
];

const LABELS: readonly Label[] = ["Bug", "Feature", "Polish"];

const ISSUES: readonly Issue[] = [
  {
    id: "ENG-129",
    title: "Dark mode for embeds",
    label: "Polish",
    who: "kit",
    status: "done",
    rank: 2,
  },
  {
    id: "ENG-131",
    title: "Keyboard nav in lists",
    label: "Feature",
    who: "priya",
    status: "done",
    rank: 1,
  },
  {
    id: "ENG-134",
    title: "Cursor jumps on paste",
    label: "Bug",
    who: "mara",
    status: "progress",
    rank: 1,
  },
  {
    id: "ENG-136",
    title: "Export notes to Markdown",
    label: "Feature",
    who: "priya",
    status: "todo",
    rank: 3,
  },
  {
    id: "ENG-137",
    title: "Faster cold start",
    label: "Polish",
    who: "jonas",
    status: "progress",
    rank: 2,
  },
  {
    id: "ENG-139",
    title: "Rename shared folders",
    label: "Polish",
    who: "kit",
    status: "todo",
    rank: 2,
  },
  {
    id: "ENG-141",
    title: "Retry failed uploads",
    label: "Bug",
    who: "jonas",
    status: "todo",
    rank: 1,
  },
];

interface Command {
  readonly id: string;
  readonly group: "Create" | "Go to";
  readonly name: string;
  readonly icon: LucideIcon;
  readonly key?: string;
}

const COMMANDS: readonly Command[] = [
  { id: "new-issue", group: "Create", name: "New issue", icon: SquarePen, key: "C" },
  { id: "new-project", group: "Create", name: "New project", icon: FolderPlus },
  { id: "new-view", group: "Create", name: "New view", icon: LayoutGrid },
  { id: "inbox", group: "Go to", name: "Go to inbox", icon: Inbox, key: "G I" },
  { id: "docs", group: "Go to", name: "Go to project docs", icon: FileText },
  { id: "invite", group: "Go to", name: "Invite a teammate", icon: UserPlus },
];

interface Draft {
  readonly title: string;
  readonly label?: Label;
  readonly who?: string;
}

interface State {
  readonly issues: readonly Issue[];
  readonly palette?: string;
  readonly draft?: Draft;
  readonly drag?: { readonly id: string; readonly over: Status };
  readonly menu?: string;
  readonly toast?: string;
}

type Msg =
  | { type: "palette" }
  | { type: "query"; text: string }
  | { type: "run"; command: string }
  | { type: "draft"; patch: Partial<Draft> }
  | { type: "create" }
  | { type: "cancel" }
  | { type: "grab"; id: string }
  | { type: "over"; status: Status }
  | { type: "drop" }
  | { type: "menu"; id?: string }
  | { type: "move"; id: string; status: Status };

const matches = (query: string) =>
  COMMANDS.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

const moveTo = (issues: readonly Issue[], id: string, status: Status): Issue[] => {
  const top = Math.min(0, ...issues.flatMap((i) => (i.status === status ? [i.rank] : [])));

  return issues.map((i) => (i.id === id ? { ...i, status, rank: top - 1 } : i));
};

const nextId = (issues: readonly Issue[]) =>
  `ENG-${Math.max(...issues.map((i) => Number(i.id.slice(4)))) + 2}`;

const update = (state: State, msg: Msg): State => {
  switch (msg.type) {
    case "palette":
      return { ...state, palette: "", draft: undefined };
    case "query":
      return { ...state, palette: msg.text };
    case "run":
      return msg.command === "new-issue"
        ? { ...state, palette: undefined, draft: { title: "" } }
        : state;
    case "draft":
      return state.draft ? { ...state, draft: { ...state.draft, ...msg.patch } } : state;
    case "create": {
      const draft = state.draft;

      if (!draft?.title.trim()) return state;

      const issue: Issue = {
        id: nextId(state.issues),
        title: draft.title.trim(),
        label: draft.label ?? "Feature",
        who: draft.who ?? "mara",

        status: "todo",
        rank: 0,
      };

      return {
        ...state,
        draft: undefined,
        issues: moveTo([...state.issues, issue], issue.id, "todo"),
      };
    }

    case "cancel":
      return { ...state, palette: undefined, draft: undefined, menu: undefined };
    case "grab": {
      const issue = state.issues.find((i) => i.id === msg.id);

      return issue
        ? {
            ...state,
            drag: { id: issue.id, over: issue.status },
            menu: undefined,
            toast: undefined,
          }
        : state;
    }

    case "over":
      return state.drag ? { ...state, drag: { ...state.drag, over: msg.status } } : state;
    case "drop":
      return state.drag
        ? {
            ...state,
            drag: undefined,
            issues: moveTo(state.issues, state.drag.id, state.drag.over),
          }
        : state;
    case "menu":
      return { ...state, menu: msg.id };
    case "move":
      return {
        ...state,
        menu: undefined,
        issues: moveTo(state.issues, msg.id, msg.status),
        toast: msg.status === "done" ? `${msg.id} moved to Done` : undefined,
      };
  }
};

const cn = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

const person = (id: string) => PEOPLE.find((p) => p.id === id)!;

const Avatar = ({ who, size = 20 }: { who: string; size?: number }) => {
  const p = person(who);

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${p.hue} 70% var(--avatar-l))`,
        color: `hsl(${p.hue} 60% var(--avatar-t))`,
      }}
    >
      {p.initials}
    </span>
  );
};

const StatusIcon = ({ status }: { status: Status }) => (
  <span className={cn("status", status)}>{status === "done" && <Check strokeWidth={3.5} />}</span>
);

const Chip = ({ label }: { label: Label }) => (
  <span className="chip">
    <span className={cn("dot", label.toLowerCase())} />
    {label}
  </span>
);

function Palette({ query, send }: { query: string; send: (msg: Msg) => void }) {
  const found = matches(query);
  const groups = (["Create", "Go to"] as const).filter((g) => found.some((c) => c.group === g));

  return (
    <div className="sheet palette" data-part="sheet">
      <div className="palette-body" data-key="palette">
        <div className="palette-input">
          <Search size={16} />
          <input
            data-part="query"
            autoFocus
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => send({ type: "query", text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && found[0]) send({ type: "run", command: found[0].id });

              if (e.key === "Escape") send({ type: "cancel" });
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="results">
          {groups.map((group) => (
            <div key={group} data-key={`group-${group}`} className="group">
              <div className="group-name">{group}</div>
              {found
                .filter((c) => c.group === group)
                .map((c) => (
                  <button
                    key={c.id}
                    data-key={c.id}
                    data-part={`cmd-${c.id}`}
                    className={cn("command", c === found[0] && "active")}
                    onClick={() => send({ type: "run", command: c.id })}
                  >
                    <c.icon size={15} />
                    <span>{c.name}</span>
                    {c.key && <kbd>{c.key}</kbd>}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewIssue({ draft, id, send }: { draft: Draft; id: string; send: (msg: Msg) => void }) {
  return (
    <div className="sheet dialog" data-part="sheet">
      <div className="dialog-body" data-key="dialog">
        <div className="crumbs">
          <span className="team">ENG</span>
          <span>›</span>
          <span>New issue</span>
          <span className="new-id">{id}</span>
        </div>
        <input
          data-part="title"
          className="title-input"
          autoFocus
          placeholder="Issue title"
          value={draft.title}
          onChange={(e) => send({ type: "draft", patch: { title: e.target.value } })}
        />
        <div className="describe">Add a description…</div>
        <div className="field">
          <span className="field-name">Label</span>
          {LABELS.map((label) => (
            <button
              key={label}
              data-part={`label-${label.toLowerCase()}`}
              className={cn("pick", draft.label === label && "picked")}
              onClick={() => send({ type: "draft", patch: { label } })}
            >
              <span className={cn("dot", label.toLowerCase())} />
              {label}
            </button>
          ))}
        </div>
        <div className="field">
          <span className="field-name">Assignee</span>
          {PEOPLE.map((p) => (
            <button
              key={p.id}
              data-part={`who-${p.id}`}
              className={cn("who", draft.who === p.id && "picked")}
              onClick={() => send({ type: "draft", patch: { who: p.id } })}
            >
              <Avatar who={p.id} size={24} />
            </button>
          ))}
          <span className="who-name">{draft.who ? person(draft.who).name : "Unassigned"}</span>
        </div>
        <div className="dialog-foot">
          <span className="chip">
            <StatusIcon status="todo" />
            Todo
          </span>
          <span className="spacer" />
          <button className="button ghost" onClick={() => send({ type: "cancel" })}>
            Cancel
          </button>
          <button
            data-part="create"
            className="button primary"
            onClick={() => send({ type: "create" })}
          >
            Create issue
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({
  issue,
  status,
  lifted,
  menu,
  send,
}: {
  issue: Issue;
  status: Status;
  lifted: boolean;
  menu: boolean;
  send: (msg: Msg) => void;
}) {
  return (
    <div
      data-key={issue.id}
      data-part={`card-${issue.id}`}
      className={cn("card", lifted && "lifted", menu && "open")}
      onPointerDown={(e) => {
        if (!(e.target instanceof Element && e.target.closest("button")))
          send({ type: "grab", id: issue.id });
      }}
    >
      <div className="card-title">
        <button
          data-part={`status-${issue.id}`}
          className="status-button"
          onClick={() => send({ type: "menu", id: menu ? undefined : issue.id })}
        >
          <StatusIcon status={status} />
        </button>
        <span>{issue.title}</span>
      </div>
      <div className="card-meta">
        <span className="issue-id">{issue.id}</span>
        <Chip label={issue.label} />
        <span className="spacer" />
        <Avatar who={issue.who} size={18} />
      </div>
      {menu && (
        <div className="menu" data-part="menu">
          {COLUMNS.map((c) => (
            <button
              key={c.status}
              data-part={`set-${c.status}`}
              className={cn("menu-item", c.status === status && "current")}
              onClick={() => send({ type: "move", id: issue.id, status: c.status })}
            >
              <StatusIcon status={c.status} />
              {c.name}
              {c.status === status && <Check size={13} className="tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Nav = ({
  icon: Icon,
  name,
  count,
  current,
}: {
  icon?: LucideIcon;
  name: string;
  count: number;
  current?: boolean;
}) => (
  <div className={cn("nav", current && "current")} data-key={`nav-${name}`}>
    {Icon && <Icon size={15} />}
    <span>{name}</span>
    <span className="count">{count}</span>
  </div>
);

const Project = ({
  name,
  hue,
  count,
  current,
}: {
  name: string;
  hue: number;
  count: number;
  current?: boolean;
}) => (
  <div className={cn("nav", current && "current")} data-part={`project-${name.toLowerCase()}`}>
    <span className="swatch" style={{ background: `hsl(${hue} 75% 55%)` }} />
    <span>{name}</span>
    <span className="count">{count}</span>
  </div>
);

export function Board(): ReactNode {
  const [state, send] = useReducer(update, { issues: ISSUES });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        send({ type: "palette" });
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dragging = state.drag !== undefined;

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const lane = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((el) => el instanceof HTMLElement && el.dataset.lane);

      const status = COLUMNS.find(
        (c) => lane instanceof HTMLElement && c.status === lane.dataset.lane,
      )?.status;

      if (status) send({ type: "over", status });
    };

    const onUp = () => send({ type: "drop" });

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const statusOf = (issue: Issue): Status =>
    state.drag?.id === issue.id ? state.drag.over : issue.status;

  const cardsIn = (status: Status): Issue[] => {
    const rank = (i: Issue) =>
      state.drag?.id === i.id && i.status !== status ? -Infinity : i.rank;

    return state.issues.filter((i) => statusOf(i) === status).sort((a, b) => rank(a) - rank(b));
  };

  const count = (status: Status) => state.issues.filter((i) => statusOf(i) === status).length;
  const done = count("done");
  const total = state.issues.length;
  const open = total - done;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="workspace">
          <span className="mark" />
          Fernhill
        </div>
        <Nav icon={Inbox} name="Inbox" count={3} />
        <Nav icon={CircleDashed} name="My issues" count={4} />
        <div className="section">Projects</div>
        <Project name="Editor" hue={28} count={open} current />
        <Project name="Sync" hue={200} count={9} />
        <Project name="Mobile" hue={330} count={4} />
        <Project name="Billing" hue={140} count={2} />
        <div className="me">
          <Avatar who="mara" size={22} />
          <span>Mara Lind</span>
        </div>
      </aside>
      <main className="main">
        <header className="top">
          <div className="crumbs">
            <span className="swatch" style={{ background: "hsl(28 75% 55%)" }} />
            <strong>Editor</strong>
            <span>›</span>
            <span>Cycle 14</span>
          </div>
          <span className="spacer" />
          <div className="search" data-part="search">
            <Search size={14} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </div>
          <button
            className="button primary"
            data-part="new"
            onClick={() => send({ type: "run", command: "new-issue" })}
          >
            <Plus size={14} strokeWidth={2.5} />
            New issue
          </button>
        </header>
        <div className="cycle">
          <span className="cycle-name">Nov 10 – Nov 21</span>
          <div className="bar" data-part="progress">
            <div className="fill" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="cycle-count">
            {done} of {total} done
          </span>
          <span className="percent">{Math.round((done / total) * 100)}%</span>
        </div>
        <div className="board" data-part="board">
          {COLUMNS.map((c) => (
            <div
              key={c.status}
              data-key={`lane-${c.status}`}
              data-lane={c.status}
              data-part={`lane-${c.status}`}
              className={cn(
                "lane",
                state.drag &&
                  state.drag.over === c.status &&
                  statusOfIssue(state) !== c.status &&
                  "over",
              )}
            >
              <div data-key={`head-${c.status}`} className="lane-head">
                <StatusIcon status={c.status} />
                <span>{c.name}</span>
                <span className="count">{count(c.status)}</span>
              </div>
              {cardsIn(c.status).map((issue) => (
                <Card
                  key={issue.id}
                  issue={issue}
                  status={c.status}
                  lifted={state.drag?.id === issue.id}
                  menu={state.menu === issue.id}
                  send={send}
                />
              ))}
            </div>
          ))}
        </div>
      </main>
      {state.toast && (
        <div className="toast" data-part="toast">
          <StatusIcon status="done" />
          <span>{state.toast}</span>
          <span className="undo">Undo</span>
        </div>
      )}
      {(state.palette !== undefined || state.draft) && (
        <div
          className="scrim"
          data-part="scrim"
          onClick={(e) => e.target === e.currentTarget && send({ type: "cancel" })}
        >
          {state.palette !== undefined ? (
            <Palette query={state.palette} send={send} />
          ) : (
            <NewIssue draft={state.draft!} id={nextId(state.issues)} send={send} />
          )}
        </div>
      )}
    </div>
  );
}

const statusOfIssue = (state: State): Status | undefined =>
  state.issues.find((i) => i.id === state.drag?.id)?.status;
