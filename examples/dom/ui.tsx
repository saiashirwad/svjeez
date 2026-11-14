/** @jsxImportSource react */
/** @jsxRuntime automatic */
// shadcn/ui components (MIT), trimmed to plain class strings so the example needs no cva or tailwind-merge.
import { AlertCircle, ArrowRight, Check, GitPullRequest } from "lucide-react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const cn = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

// The hover and focus classes are shadcn's, so a real pointer or keyboard in the live page restyles them.
const BUTTON = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium shrink-0 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
};

const Button = ({
  variant = "default",
  children,
  part,
  className,
}: {
  variant?: Exclude<keyof typeof BUTTON, "base">;
  children: ReactNode;
  part?: string;
  className?: string;
}) => (
  <button
    data-part={part}
    className={cn(BUTTON.base, BUTTON[variant], "h-9 px-4 py-2 has-[>svg]:px-3", className)}
  >
    {children}
  </button>
);

const BADGE = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "text-foreground",
};

const Badge = ({
  variant = "default",
  children,
  part,
}: {
  variant?: keyof typeof BADGE;
  children: ReactNode;
  part?: string;
}) => (
  <span
    data-part={part}
    className={cn(
      "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1",
      BADGE[variant],
    )}
  >
    {children}
  </span>
);

const Card = ({
  children,
  className,
  part,
}: {
  children: ReactNode;
  className?: string;
  part?: string;
}) => (
  <div
    data-part={part}
    className={cn(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      className,
    )}
  >
    {children}
  </div>
);

const CardHeader = ({ children }: { children: ReactNode }) => (
  <div className="grid auto-rows-min items-start gap-1.5 px-6">{children}</div>
);

const CardTitle = ({ children }: { children: ReactNode }) => (
  <div className="leading-none font-semibold">{children}</div>
);

const CardDescription = ({ children }: { children: ReactNode }) => (
  <div className="text-muted-foreground text-sm">{children}</div>
);

const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("px-6", className)}>{children}</div>
);

const CardFooter = ({
  children,
  className,
  part,
}: {
  children: ReactNode;
  className?: string;
  part?: string;
}) => (
  <div data-part={part} className={cn("flex items-center px-6", className)}>
    {children}
  </div>
);

const Label = ({ children }: { children: ReactNode }) => (
  <label className="flex items-center gap-2 text-sm leading-none font-medium select-none">
    {children}
  </label>
);

const Input = ({
  placeholder,
  value,
  part,
  type,
  invalid,
}: {
  placeholder?: string;
  value?: string;
  part?: string;
  type?: string;
  invalid?: boolean;
}) => (
  <input
    data-part={part}
    type={type}
    placeholder={placeholder}
    defaultValue={value}
    className={cn(
      "placeholder:text-muted-foreground border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      invalid && "border-destructive ring-destructive/20 ring-[3px]",
    )}
  />
);

const Switch = ({ checked, part }: { checked: boolean; part?: string }) => (
  <button
    role="switch"
    data-part={part}
    data-state={checked ? "checked" : "unchecked"}
    className="peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs"
  >
    <span
      data-part={part && `${part}-thumb`}
      data-state={checked ? "checked" : "unchecked"}
      className="bg-background pointer-events-none block size-4 rounded-full ring-0 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
    />
  </button>
);

const Alert = ({
  title,
  children,
  part,
}: {
  title: string;
  children: ReactNode;
  part?: string;
}) => (
  <div
    data-part={part}
    role="alert"
    className="bg-card text-destructive relative w-full rounded-lg border px-4 py-3 text-sm grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current"
  >
    <AlertCircle />
    <div className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight">{title}</div>
    <div className="text-destructive/90 col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed">
      {children}
    </div>
  </div>
);

const Avatar = ({ initials, part }: { initials: string; part?: string }) => (
  <span data-part={part} className="relative flex size-8 shrink-0 overflow-hidden rounded-full">
    <span className="bg-muted flex size-full items-center justify-center rounded-full text-xs font-medium">
      {initials}
    </span>
  </span>
);

/** The pieces the scene snapshots, each as static HTML. Any framework that renders HTML works the same way. */
export const pieces = {
  login: (error: boolean) =>
    renderToStaticMarkup(
      <Card className="w-[360px]" part="card">
        <CardHeader>
          <CardTitle>Sign in to your account</CardTitle>
          <CardDescription>Enter your email below to sign in.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert title="Unable to sign in." part="alert">
              <p>Check your email and password.</p>
            </Alert>
          )}
          <div className="grid gap-2" data-part="field">
            <Label>Email</Label>
            <Input
              placeholder="m@example.com"
              value={error ? "sai@exmaple.com" : undefined}
              part="email"
              invalid={error}
            />
          </div>
          <div className="grid gap-2" data-part="field">
            <Label>Password</Label>
            <Input type="password" value={error ? "hunter2hunter2" : undefined} part="password" />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button className="w-full" part="submit">
            {error ? "Try again" : "Sign in"} <ArrowRight />
          </Button>
          <Button variant="outline" className="w-full" part="secondary">
            Sign in with GitHub
          </Button>
        </CardFooter>
      </Card>,
    ),
  pr: (merged: boolean) =>
    renderToStaticMarkup(
      <Card className="w-[420px] gap-4 py-4">
        <CardContent className="flex items-center gap-3">
          <Avatar initials="SA" />
          <div className="flex-1 grid gap-1">
            <div className="text-sm font-medium leading-none">Snapshot DOM into svjeez</div>
            <div className="text-muted-foreground text-xs">#412 · dom-snapshot-prototype</div>
          </div>
          <Badge variant={merged ? "default" : "outline"} part="status">
            <GitPullRequest /> {merged ? "Merged" : "Open"}
          </Badge>
        </CardContent>
        {merged && (
          <CardContent className="flex items-center gap-2 text-sm">
            <span
              data-part="checks"
              className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white [&>svg]:size-3"
            >
              <Check />
            </span>
            All 14 checks passed
          </CardContent>
        )}
        <CardFooter className="justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={merged} part="switch" /> Auto-merge
          </div>
          <Badge variant="secondary">{merged ? "+230 −12" : "+214 −12"}</Badge>
        </CardFooter>
      </Card>,
    ),
};
