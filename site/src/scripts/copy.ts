const HOLD = 1600;
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

const keys = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘C" : "Ctrl+C");

const select = (element: Element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export const copy = async (
  button: HTMLElement,
  text: string,
  { say, fallback, done = "Copied" }: { say: HTMLElement; fallback: Element; done?: string },
) => {
  let ok = true;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = false;
  }

  button.dataset.copied = ok ? "ok" : "failed";
  say.textContent = ok ? done : `Your browser blocked copying. It's selected, so press ${keys()}.`;

  if (!ok) select(fallback);
  clearTimeout(timers.get(button));
  timers.set(
    button,
    setTimeout(
      () => {
        delete button.dataset.copied;
        say.textContent = "";
      },
      ok ? HOLD : HOLD * 3,
    ),
  );

  return ok;
};
