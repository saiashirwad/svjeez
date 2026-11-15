/** @jsxImportSource react */
// shadcn/ui components (MIT), trimmed to plain class strings, as an app would have them. Stateful, like real ones.
import { AlertCircle, ArrowRight, Check, GitPullRequest } from "lucide-react";
import { useState, type ReactNode } from "react";
import "./app.css";

const cn = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

const BUTTON = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium shrink-0 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
};

const Button = ({
  variant = "default",
  children,
  className,
  ...rest
}: {
  variant?: Exclude<keyof typeof BUTTON, "base">;
  children: ReactNode;
  className?: string;
  "data-part"?: string;
}) => (
  <button {...rest} className={cn(BUTTON.base, BUTTON[variant], "h-9 px-4 py-2 has-[>svg]:px-3", className)}>
    {children}
  </button>
);

const Badge = ({ outline, children, ...rest }: { outline?: boolean; children: ReactNode; "data-part"?: string }) => (
  <span
    {...rest}
    className={cn(
      "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1",
      outline ? "text-foreground" : "border-transparent bg-primary text-primary-foreground",
    )}
  >
    {children}
  </span>
);

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className)}>
    {children}
  </div>
);

const Input = ({
  value,
  onChange,
  invalid,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  type?: string;
  placeholder?: string;
  "data-part"?: string;
}) => (
  <input
    {...rest}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      "placeholder:text-muted-foreground border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      invalid && "border-destructive ring-destructive/20 ring-[3px]",
    )}
  />
);

/** A sign-in form. Typing is its own state; the parent says when the server turned it down. */
export function SignIn({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-[360px]">
      <div className="grid gap-1.5 px-6">
        <div className="leading-none font-semibold">Sign in to your account</div>
        <div className="text-muted-foreground text-sm">Enter your email below to sign in.</div>
      </div>
      <div className="flex flex-col gap-4 px-6">
        {error && (
          <div
            role="alert"
            data-part="alert"
            className="bg-card text-destructive relative w-full rounded-lg border px-4 py-3 text-sm grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5"
          >
            <AlertCircle />
            <div className="col-start-2 font-medium tracking-tight">{error}</div>
            <div className="text-destructive/90 col-start-2 text-sm">Check your email and password.</div>
          </div>
        )}
        <label data-part="email-field" className="grid gap-2 text-sm font-medium">
          Email
          <Input data-part="email" placeholder="m@example.com" value={email} onChange={setEmail} invalid={!!error} />
        </label>
        <label data-part="password-field" className="grid gap-2 text-sm font-medium">
          Password
          <Input data-part="password" type="password" value={password} onChange={setPassword} />
        </label>
      </div>
      <div className="flex flex-col gap-2 px-6">
        <Button data-part="submit" className="w-full">
          {error ? "Try again" : "Sign in"} <ArrowRight />
        </Button>
        <Button variant="outline" className="w-full">
          Sign in with GitHub
        </Button>
      </div>
    </Card>
  );
}

/** A pull request. Auto-merge is a switch the user flips; merging comes from outside. */
export function PullRequest({ merged = false }: { merged?: boolean }) {
  const [auto, setAuto] = useState(false);

  return (
    <Card className="w-[420px] gap-4 py-4">
      <div className="flex items-center gap-3 px-6">
        <span className="bg-muted flex size-8 items-center justify-center rounded-full text-xs font-medium">SA</span>
        <div className="flex-1 grid gap-1">
          <div className="text-sm font-medium leading-none">Record React components</div>
          <div className="text-muted-foreground text-xs">#418 · react-component-demos</div>
        </div>
        <Badge outline={!merged} data-part="status">
          <GitPullRequest /> {merged ? "Merged" : "Open"}
        </Badge>
      </div>
      {merged && (
        <div className="flex items-center gap-2 px-6 text-sm">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white [&>svg]:size-3">
            <Check />
          </span>
          All 14 checks passed
        </div>
      )}
      <div className="flex items-center justify-between px-6">
        <button
          role="switch"
          data-part="auto"
          data-state={auto ? "checked" : "unchecked"}
          onClick={() => setAuto(!auto)}
          className="flex items-center gap-2 text-sm"
        >
          <span
            className={cn(
              "inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs",
              auto ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "bg-background block size-4 rounded-full",
                auto ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
              )}
            />
          </span>
          Auto-merge
        </button>
        <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-medium">
          {merged ? "+230 −12" : "+214 −12"}
        </span>
      </div>
    </Card>
  );
}
